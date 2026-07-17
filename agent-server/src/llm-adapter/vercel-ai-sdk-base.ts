/**
 * Base compartida para providers via Vercel AI SDK v5/v6.
 *
 * Implementa la mecánica común: `streamText` + `generateText` + normalización de eventos del
 * AI SDK al `NormalizedEvent` cross-provider. Los providers concretos (`anthropic-api.ts`,
 * `openrouter.ts`) solo proveen un `LanguageModelV1` configurado y diferencias específicas.
 *
 * Degradación de capabilities documentada vs claude-code-sdk:
 *   - memoryToolNative: false (template del alumno reimplementa Memory Tool via Supabase
 *     `<prefix>_memories` + RPCs `match_*` / `touch_*` / `decay_*` / `compact_*`).
 *   - cwdSessions: false (sesiones persisten en Supabase `chat_sessions` + `chat_messages`,
 *     no en `~/.claude/projects/*.jsonl`).
 *   - thinkingSummarized: depende del modelo activo (Anthropic Sonnet 4.6+ / Opus 4.6+ via API
 *     directa sí; otros providers via OpenRouter no garantizado).
 *   - dynamicTools: true (AI SDK soporta tool use; el shape se normaliza al cruzar al MC).
 *   - prewarm: no-op (no hay subprocess CLI).
 *   - dynamicModelList: false (lista hardcoded por provider; ver llm-providers docs).
 */

import { streamText, generateText, type LanguageModel } from 'ai'
import { AGENT_TIMEOUT_MS } from '../config.js'
import { logger } from '../logger.js'
import { opsLogger } from '../ops-logger.js'
import type {
  LLMProvider,
  LLMProviderName,
  ProviderCapabilities,
  StreamInput,
  CompleteInput,
  CompleteResult,
  ModelInfo,
  NormalizedEvent,
} from './types.js'

export interface VercelProviderConfig {
  name: LLMProviderName
  /** Modelo default si no se setea explícitamente. */
  defaultModel: string
  /** Constructor del LanguageModel para un modelId dado. */
  buildModel: (modelId: string) => LanguageModel
  /** Lista hardcoded de modelos disponibles para `getAvailableModels()`. */
  availableModels: ModelInfo[]
  /** Capabilities específicas del provider (sobrescribe defaults). */
  capabilityOverrides?: Partial<ProviderCapabilities>
}

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  memoryToolNative: false,
  cwdSessions: false,
  thinkingSummarized: false,
  dynamicTools: true,
  prewarm: false,
  dynamicModelList: false,
}

export function createVercelAdapter(config: VercelProviderConfig): LLMProvider {
  const capabilities: ProviderCapabilities = {
    ...DEFAULT_CAPABILITIES,
    ...(config.capabilityOverrides ?? {}),
  }

  let currentModelId: string | null = config.defaultModel
  let lastContextTokens: number | null = null
  let contextWindowSize: number | null = null

  return {
    name: config.name,
    capabilities,

    async *stream(input: StreamInput): AsyncGenerator<NormalizedEvent> {
      if (input.modelOverride) currentModelId = input.modelOverride
      const modelId = currentModelId ?? config.defaultModel

      const ac = new AbortController()
      const timeout = setTimeout(() => ac.abort(), AGENT_TIMEOUT_MS)
      if (input.signal) {
        input.signal.addEventListener('abort', () => ac.abort(), { once: true })
      }

      const source = input.source ?? 'web'
      // El sessionId aquí es para tracking (logging + persistencia downstream); no se usa para
      // resume del lado del provider — sesiones viven en Supabase del template del alumno.
      const sessionId = input.sessionId ?? crypto.randomUUID()
      let resultText = ''
      const started = Date.now()
      let totalInputTokens = 0
      let totalOutputTokens = 0

      try {
        opsLogger.log('session_start', source, {
          model: modelId,
          prompt: input.prompt.slice(0, 200),
          provider: config.name,
        }, sessionId)

        yield { type: 'init', sessionId }

        const result = streamText({
          model: config.buildModel(modelId),
          prompt: input.prompt,
          abortSignal: ac.signal,
        })

        // AI SDK v6 expone `fullStream` para acceso granular a chunks de texto/reasoning/tool.
        // Iteramos y mapeamos a NormalizedEvent.
        for await (const chunk of result.fullStream) {
          if (chunk.type === 'text-delta') {
            const t = (chunk as unknown as { text?: string; textDelta?: string })
            const text = t.text ?? t.textDelta ?? ''
            if (text) {
              resultText += text
              yield { type: 'text_delta', text }
            }
          } else if (chunk.type === 'reasoning-delta') {
            // AI SDK v6 emite reasoning-delta chunks cuando el modelo lo soporta (Anthropic via API).
            // reasoning-start/reasoning-end son envoltorios — solo el delta lleva texto.
            const t = (chunk as unknown as { text?: string; textDelta?: string })
            const text = t.text ?? t.textDelta ?? ''
            if (text) {
              yield { type: 'thinking_delta', text }
            }
          } else if (chunk.type === 'tool-call') {
            const c = chunk as unknown as { toolCallId: string; toolName: string; input?: unknown }
            yield { type: 'tool_start', toolName: c.toolName, toolId: c.toolCallId }
            yield { type: 'tool_input', toolId: c.toolCallId, input: c.input ?? {} }
          } else if (chunk.type === 'tool-result') {
            const c = chunk as unknown as { toolCallId: string; output?: unknown }
            yield { type: 'tool_output', toolId: c.toolCallId, output: c.output ?? null }
            yield { type: 'tool_done', toolId: c.toolCallId }
          } else if (chunk.type === 'finish') {
            const c = chunk as unknown as { usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
            const usage = c.usage
            if (usage) {
              totalInputTokens = usage.inputTokens ?? 0
              totalOutputTokens = usage.outputTokens ?? 0
            }
          } else if (chunk.type === 'error') {
            const c = chunk as unknown as { error?: unknown }
            const msg = c.error instanceof Error ? c.error.message : String(c.error ?? 'unknown stream error')
            opsLogger.log('agent_error', source, { error: msg, provider: config.name }, sessionId)
            yield { type: 'error', message: msg }
          }
        }

        const durationMs = Date.now() - started
        lastContextTokens = totalInputTokens
        // Context window: el AI SDK no expone esto cross-provider; usamos defaults conservadores
        // según provider (override en config si aplica futuro).
        if (contextWindowSize == null) {
          contextWindowSize = config.name === 'openrouter' ? 128_000 : 200_000
        }

        opsLogger.log('agent_result', source, {
          costUsd: 0,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          durationMs,
          numTurns: 1,
          model: modelId,
          resultLength: resultText.length,
          provider: config.name,
        }, sessionId)

        yield {
          type: 'usage',
          costUsd: 0,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          durationMs,
          numTurns: 1,
          model: modelId,
          ...(lastContextTokens !== null ? { contextUsed: lastContextTokens } : {}),
          ...(contextWindowSize !== null ? { contextTotal: contextWindowSize } : {}),
        }

        yield { type: 'result', text: resultText }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ err, provider: config.name }, 'vercel-ai-sdk: stream error')
        opsLogger.log('agent_error', source, { error: msg, provider: config.name }, sessionId)
        if (ac.signal.aborted) {
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

      const modelId = input.model ?? currentModelId ?? config.defaultModel
      const source = input.source ?? 'system'

      try {
        const { text, usage } = await generateText({
          model: config.buildModel(modelId),
          prompt: input.prompt,
          abortSignal: ac.signal,
        })

        const durationMs = Date.now() - started
        const inputTokens = usage?.inputTokens ?? 0
        const outputTokens = usage?.outputTokens ?? 0

        opsLogger.log('agent_result', source, {
          costUsd: 0,
          inputTokens,
          outputTokens,
          durationMs,
          model: modelId,
          resultLength: text.length,
          provider: config.name,
          complete: true,
        })

        return {
          text,
          usage: { inputTokens, outputTokens },
          durationMs,
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error({ err, provider: config.name }, 'vercel-ai-sdk: complete error')
        opsLogger.log('agent_error', source, { error: msg, provider: config.name, complete: true })
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

    async getAvailableModels(): Promise<ModelInfo[]> {
      // Lista hardcoded por provider. La doc de cada provider en
      // `setup/llm-providers/<provider>.md` documenta cómo agregar modelos.
      return config.availableModels
    },

    getContextInfo(): { used: number | null; total: number | null } {
      return { used: lastContextTokens, total: contextWindowSize }
    },

    async prewarm(): Promise<void> {
      // No-op para providers via Vercel AI SDK — no hay subprocess CLI que warm-up.
      // Sub-fase 0 del bucle-agentico interpretó esto correctamente: el provider arranca
      // listo en cada call (latencia primer turn = latencia de red al API del provider).
      return
    },

    isPrewarmed(): boolean {
      return true // siempre listo (no hay state warm-up)
    },
  }
}
