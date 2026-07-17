/**
 * Implementación LLMProvider con SDK Claude Code (`@anthropic-ai/claude-agent-sdk@0.2.128`).
 *
 * Wrap byte-exact del comportamiento histórico de `agent.ts` pre-PRP-037. Preserva todas las
 * capabilities canónicas: Memory Tool nativo (via `memory: project` en frontmatter del subagent),
 * cwd-shared sessions (lee `~/.claude/projects/<slug>/*.jsonl`), thinking_delta summarized,
 * tool_use con `input_json_delta` fragmentado parseado en `content_block_stop`, tool_result via
 * `SDKUserMessage` branch, model dynamic selection, prewarm del subprocess CLI.
 *
 * Aprendizaje canónico PRP-029 + PRP-032 absorbido: thinking summarized requiere
 * `thinking: { type: 'adaptive', display: 'summarized' }` explícito en options (default omitted
 * sería redacted).
 */

import { query, startup, type Query, type ModelInfo as SdkModelInfo } from '@anthropic-ai/claude-agent-sdk'
import { PROJECT_ROOT, AGENT_TIMEOUT_MS } from '../config.js'
import { logger } from '../logger.js'
import { opsLogger } from '../ops-logger.js'
import type {
  LLMProvider,
  ProviderCapabilities,
  StreamInput,
  CompleteInput,
  CompleteResult,
  ModelInfo,
  NormalizedEvent,
} from './types.js'

const CAPABILITIES: ProviderCapabilities = {
  memoryToolNative: true,
  cwdSessions: true,
  thinkingSummarized: true,
  dynamicTools: true,
  prewarm: true,
  dynamicModelList: true,
}

let currentModelId: string | null = null
let contextWindowSize: number | null = null
let lastContextTokens: number | null = null
let sdkPrewarmed = false

export const claudeCodeSdkProvider: LLMProvider = {
  name: 'claude-code-sdk',
  capabilities: CAPABILITIES,

  async *stream(input: StreamInput): AsyncGenerator<NormalizedEvent> {
    if (input.modelOverride) currentModelId = input.modelOverride

    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS)
    if (input.signal) {
      input.signal.addEventListener('abort', () => ac.abort(), { once: true })
    }

    let resultText = ''
    let inTool = false
    let currentToolId: string | null = null
    let currentToolName: string | null = null
    let toolStartTime = 0
    let streamSessionId: string | undefined
    let lastTurnInputTokens: number | null = null
    const seenAssistantIds = new Set<string>()
    const toolInputBuffers = new Map<string, { name: string; partialJson: string }>()
    const source = input.source ?? 'web'

    try {
      const stream = query({
        prompt: input.prompt,
        options: {
          cwd: PROJECT_ROOT,
          ...(input.sessionId && { resume: input.sessionId }),
          settingSources: ['project', 'user'],
          hooks: {},
          permissionMode: 'bypassPermissions',
          abortController: ac,
          includePartialMessages: true,
          env: { ...process.env, AGENT_SERVER_DAEMON: '1' } as Record<string, string>,
          thinking: { type: 'adaptive', display: 'summarized' },
          ...(input.effort && { effort: input.effort }),
          ...(currentModelId && { model: currentModelId }),
        },
      })

      input.onQuery?.(stream as unknown as Query)

      for await (const event of stream) {
        const e = event as Record<string, unknown>

        if (e['type'] === 'system' && e['subtype'] === 'init') {
          if (e['model']) currentModelId = e['model'] as string
          streamSessionId = e['session_id'] as string
          opsLogger.log('session_start', source, {
            model: currentModelId,
            prompt: input.prompt.slice(0, 200),
          }, streamSessionId)
          yield {
            type: 'init',
            sessionId: streamSessionId,
            ...(e['slash_commands'] !== undefined ? { slashCommands: e['slash_commands'] as string[] } : {}),
          }
        }

        if (e['type'] === 'system' && e['subtype'] === 'compact_boundary') {
          const meta = e['compact_metadata'] as Record<string, unknown> | undefined
          const preTokens = meta?.['pre_tokens'] as number | undefined
          lastTurnInputTokens = null
          seenAssistantIds.clear()
          opsLogger.log('session_compact', source, { tokensBefore: preTokens }, streamSessionId)
          yield {
            type: 'compact',
            ...(preTokens !== undefined ? { tokensBefore: preTokens } : {}),
          }
        }

        if (e['type'] === 'assistant') {
          const msg = e['message'] as { id?: string; usage?: Record<string, number> } | undefined
          const msgId = msg?.id
          const usage = msg?.usage
          if (msgId && usage && !seenAssistantIds.has(msgId)) {
            seenAssistantIds.add(msgId)
            const totalContext = (usage['input_tokens'] ?? 0)
              + (usage['cache_creation_input_tokens'] ?? 0)
              + (usage['cache_read_input_tokens'] ?? 0)
            if (totalContext > 0) lastTurnInputTokens = totalContext
          }
        }

        if (e['type'] === 'user') {
          const msg = e['message'] as { content?: unknown } | undefined
          const content = msg?.content
          if (Array.isArray(content)) {
            for (const block of content) {
              const b = block as Record<string, unknown>
              if (b?.['type'] === 'tool_result') {
                const toolUseId = b['tool_use_id'] as string | undefined
                if (!toolUseId) continue
                const rawOutput = b['content']
                const isError = b['is_error'] === true ? true : undefined
                const output: unknown = rawOutput ?? null
                yield {
                  type: 'tool_output',
                  toolId: toolUseId,
                  output,
                  ...(isError !== undefined ? { isError } : {}),
                }
              }
            }
          }
        }

        if (e['type'] === 'stream_event') {
          const ev = e['event'] as Record<string, unknown>
          const evType = ev['type'] as string

          if (evType === 'content_block_start') {
            const block = ev['content_block'] as Record<string, unknown>
            if (block?.['type'] === 'tool_use') {
              const toolName = block['name'] as string
              const toolId = block['id'] as string
              inTool = true
              currentToolId = toolId
              currentToolName = toolName
              toolStartTime = Date.now()
              toolInputBuffers.set(toolId, { name: toolName, partialJson: '' })
              opsLogger.log('tool_start', source, { toolName, toolId }, streamSessionId)
              yield { type: 'tool_start', toolName, toolId }
            }
          }

          if (evType === 'content_block_delta') {
            const delta = ev['delta'] as Record<string, unknown>
            const deltaType = delta?.['type'] as string | undefined

            if (deltaType === 'text_delta' && !inTool) {
              const text = delta['text'] as string
              resultText += text
              yield { type: 'text_delta', text }
            }

            if (deltaType === 'thinking_delta') {
              const text = delta['thinking'] as string
              if (text && text.length > 0) {
                yield { type: 'thinking_delta', text }
              }
            }

            if (deltaType === 'input_json_delta' && inTool && currentToolId) {
              const partial = (delta['partial_json'] as string) ?? ''
              const buf = toolInputBuffers.get(currentToolId)
              if (buf) buf.partialJson += partial
            }
          }

          if (evType === 'content_block_stop') {
            if (inTool && currentToolId) {
              const buf = toolInputBuffers.get(currentToolId)
              if (buf) {
                let parsedInput: unknown
                if (buf.partialJson.trim().length > 0) {
                  try {
                    parsedInput = JSON.parse(buf.partialJson)
                  } catch {
                    parsedInput = { _raw: buf.partialJson }
                  }
                } else {
                  parsedInput = {}
                }
                yield { type: 'tool_input', toolId: currentToolId, input: parsedInput }
                toolInputBuffers.delete(currentToolId)
              }

              const elapsed = Date.now() - toolStartTime
              opsLogger.log('tool_done', source, {
                toolName: currentToolName,
                toolId: currentToolId,
                durationMs: elapsed,
              }, streamSessionId)
              yield { type: 'tool_done', toolId: currentToolId }
              inTool = false
              currentToolId = null
              currentToolName = null
            }
          }
        }

        if (e['type'] === 'result') {
          const raw = e['result']
          if (typeof raw === 'string') {
            resultText = raw
          } else if (raw && typeof raw === 'object' && 'result' in raw) {
            resultText = (raw as { result: string }).result
          }

          const modelUsage = e['modelUsage'] as Record<string, Record<string, unknown>> | undefined
          if (modelUsage) {
            const models = Object.keys(modelUsage)
            if (models.length > 0) {
              const firstModel = models[0]!
              currentModelId = firstModel
              const info = modelUsage[firstModel]
              if (typeof info?.['contextWindow'] === 'number') {
                contextWindowSize = info['contextWindow'] as number
              }
            }
          }
          if (contextWindowSize == null) contextWindowSize = 200_000

          const costUsd = (e['total_cost_usd'] as number) ?? 0
          const usage = (e['usage'] as Record<string, number>) ?? {}
          const durationMs = (e['duration_ms'] as number) ?? 0
          const numTurns = (e['num_turns'] as number) ?? 0

          if (lastTurnInputTokens != null) {
            lastContextTokens = lastTurnInputTokens
          }

          opsLogger.log('agent_result', source, {
            costUsd,
            inputTokens: usage['input_tokens'] ?? 0,
            outputTokens: usage['output_tokens'] ?? 0,
            durationMs,
            numTurns,
            model: currentModelId,
            resultLength: resultText.length,
          }, streamSessionId)

          yield {
            type: 'usage',
            costUsd,
            inputTokens: usage['input_tokens'] ?? 0,
            outputTokens: usage['output_tokens'] ?? 0,
            durationMs,
            numTurns,
            ...(currentModelId !== null ? { model: currentModelId } : {}),
            ...(lastContextTokens !== null ? { contextUsed: lastContextTokens } : {}),
            ...(contextWindowSize !== null ? { contextTotal: contextWindowSize } : {}),
          }

          const terminalReason = e['terminal_reason'] as string | undefined
          yield {
            type: 'result',
            text: resultText,
            ...(terminalReason !== undefined ? { terminalReason } : {}),
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'claude-code-sdk: stream error')
      const msg = String(err)
      opsLogger.log('agent_error', source, { error: msg }, streamSessionId)
      if (ac.signal.aborted || msg.includes('abort')) {
        yield { type: 'error', message: 'Aborted.' }
      } else {
        yield { type: 'error', message: msg }
      }
    } finally {
      clearTimeout(timeout)
    }
  },

  async complete(input: CompleteInput): Promise<CompleteResult> {
    const started = Date.now()
    const ac = new AbortController()
    const effectiveTimeout = input.timeoutMs ?? AGENT_TIMEOUT_MS
    const timeout = setTimeout(() => ac.abort(), effectiveTimeout)
    if (input.signal) {
      input.signal.addEventListener('abort', () => ac.abort(), { once: true })
    }

    let resultText = ''
    let inputTokens = 0
    let outputTokens = 0
    let costUsd: number | undefined
    const source = input.source ?? 'system'
    const modelToUse = input.model ?? currentModelId

    try {
      const stream = query({
        prompt: input.prompt,
        options: {
          cwd: PROJECT_ROOT,
          settingSources: ['project', 'user'],
          hooks: {},
          permissionMode: 'bypassPermissions',
          abortController: ac,
          env: { ...process.env, AGENT_SERVER_DAEMON: '1' } as Record<string, string>,
          ...(modelToUse && { model: modelToUse }),
        },
      })

      for await (const event of stream) {
        const e = event as Record<string, unknown>
        if (e['type'] === 'result') {
          const raw = e['result']
          if (typeof raw === 'string') {
            resultText = raw
          } else if (raw && typeof raw === 'object' && 'result' in raw) {
            resultText = (raw as { result: string }).result
          }
          const usage = (e['usage'] as Record<string, number>) ?? {}
          inputTokens = usage['input_tokens'] ?? 0
          outputTokens = usage['output_tokens'] ?? 0
          costUsd = (e['total_cost_usd'] as number) ?? undefined
        }
      }

      const durationMs = Date.now() - started
      opsLogger.log('agent_result', source, {
        costUsd: costUsd ?? 0,
        inputTokens,
        outputTokens,
        durationMs,
        model: modelToUse,
        resultLength: resultText.length,
        complete: true,
      })

      return {
        text: resultText,
        usage: { inputTokens, outputTokens, ...(costUsd !== undefined ? { costUsd } : {}) },
        durationMs,
      }
    } catch (err) {
      logger.error({ err }, 'claude-code-sdk: complete error')
      opsLogger.log('agent_error', source, { error: String(err), complete: true })
      if (ac.signal.aborted) {
        throw new Error('Took too long thinking. Try again.')
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  },

  getCurrentModel(): string | null {
    return currentModelId
  },

  setCurrentModel(model: string): void {
    currentModelId = model
  },

  async getAvailableModels(sessionId?: string): Promise<ModelInfo[]> {
    const ac = new AbortController()
    const timeout = setTimeout(() => ac.abort(), 30_000)
    try {
      const stream = query({
        prompt: '/status',
        options: {
          cwd: PROJECT_ROOT,
          ...(sessionId && { resume: sessionId }),
          settingSources: ['project', 'user'],
          permissionMode: 'bypassPermissions',
          abortController: ac,
        },
      })
      const sdkModels = (await stream.supportedModels()) as SdkModelInfo[]
      await stream.interrupt()
      return sdkModels.map((m): ModelInfo => {
        const raw = m as unknown as Record<string, unknown>
        const id = (raw['value'] as string | undefined) ?? (raw['id'] as string | undefined) ?? ''
        const displayName = raw['displayName']
        const contextWindow = raw['contextWindow']
        return {
          id,
          ...(typeof displayName === 'string' && displayName.length > 0 ? { displayName } : {}),
          ...(typeof contextWindow === 'number' ? { contextWindow } : {}),
        }
      })
    } catch (err) {
      logger.error({ err }, 'claude-code-sdk: getAvailableModels error')
      return []
    } finally {
      clearTimeout(timeout)
    }
  },

  getContextInfo(): { used: number | null; total: number | null } {
    return { used: lastContextTokens, total: contextWindowSize }
  },

  async prewarm(): Promise<void> {
    try {
      if (typeof startup === 'function') {
        await startup({ options: { cwd: PROJECT_ROOT } })
        sdkPrewarmed = true
        logger.info({ cwd: PROJECT_ROOT, provider: 'claude-code-sdk' }, 'SDK pre-warm complete')
      } else {
        logger.warn('SDK startup() not available in this version (non-fatal)')
      }
    } catch (err) {
      logger.warn({ err }, 'claude-code-sdk: pre-warm failed (non-fatal)')
    }
  },

  isPrewarmed(): boolean {
    return sdkPrewarmed
  },
}
