/**
 * Runs one orchestrated answer through the Agent SDK.
 *
 * The model is boxed in three independent ways, so a prompt-injection that talks
 * the model into misbehaving still cannot do anything dangerous:
 *   1. `tools: []` removes every built-in tool (no Bash / Read / Write / etc.).
 *   2. `allowedTools` lists only the read-only `mcp__gannet__*` tools.
 *   3. `canUseTool` hard-denies anything outside that namespace, as defence in
 *      depth in case the allowlist is ever widened by mistake.
 * `settingSources: []` keeps the CLI from loading any local settings or CLAUDE.md.
 *
 * The result reports whether a tool was actually called this turn, which the
 * caller's number-guard needs: a currency/number in the text with no tool call
 * behind it is discarded and the deterministic fallback is used instead.
 */

import { query, type PermissionResult } from '@anthropic-ai/claude-agent-sdk'
import { ANSWER_TIMEOUT_MS, CLAUDE_BINARY_PATH } from './config.js'
import { SYSTEM_PROMPT } from './prompt.js'
import { ALL_TOOL_NAMES, TOOL_PREFIX, gannetMcpServer } from './tools/index.js'

/** Built-in tools explicitly named as denied, belt-and-suspenders over `tools: []`. */
const DENIED_BUILTINS = [
  'Bash',
  'Read',
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'Glob',
  'Grep',
  'Task',
  'TodoWrite',
]

export interface OrchestratorResult {
  readonly answer: string
  readonly toolUsed: boolean
  readonly toolNames: readonly string[]
}

/**
 * Strips any tool-call markup the model may accidentally emit as plain text
 * instead of as a real tool invocation (`<function_calls>`, `<invoke>`,
 * `<*>`, `<parameter>`). Such markup must never reach the projector.
 */
function stripToolMarkup(raw: string): string {
  return raw
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '')
    .replace(/<\/?(?:antml:)?(?:invoke|parameter|function_calls)[^>]*>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** True when the raw text carried tool-call markup — a sign the turn misfired. */
function looksLikeFakedToolCall(raw: string): boolean {
  return /<\/?(?:antml:)?(?:invoke|function_calls)/i.test(raw)
}

/** Permission gate: allow only our read-only tools, deny everything else. */
async function permissionGate(toolName: string): Promise<PermissionResult> {
  if (toolName.startsWith(TOOL_PREFIX)) return { behavior: 'allow', updatedInput: {} }
  return { behavior: 'deny', message: 'Solo se permiten las consultas de datos en modo lectura.' }
}

/** Extracts assistant text and records which read-only tools were invoked. */
function collect(
  message: { type: string; message?: { content?: unknown } },
  parts: string[],
  tools: Set<string>,
): void {
  if (message.type !== 'assistant') return
  const content = message.message?.content
  if (!Array.isArray(content)) return
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const b = block as { type?: string; text?: string; name?: string }
    if (b.type === 'text' && typeof b.text === 'string') parts.push(b.text)
    if (b.type === 'tool_use' && typeof b.name === 'string' && b.name.startsWith(TOOL_PREFIX)) {
      tools.add(b.name)
    }
  }
}

/**
 * Answers one question. Throws on SDK/subscription failure or timeout so the
 * caller can fall back; never returns a partial or fabricated answer.
 */
export async function orchestrate(question: string): Promise<OrchestratorResult> {
  const parts: string[] = []
  const tools = new Set<string>()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANSWER_TIMEOUT_MS)
  try {
    for await (const message of query({
      prompt: question,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        tools: [],
        mcpServers: { gannet: gannetMcpServer },
        allowedTools: [...ALL_TOOL_NAMES],
        disallowedTools: DENIED_BUILTINS,
        canUseTool: permissionGate,
        settingSources: [],
        pathToClaudeCodeExecutable: CLAUDE_BINARY_PATH,
        thinking: { type: 'disabled' },
        maxTurns: 6,
        abortController: controller,
        includePartialMessages: false,
      },
    })) {
      collect(message as { type: string; message?: { content?: unknown } }, parts, tools)
    }
  } finally {
    clearTimeout(timeout)
  }

  const raw = parts.join('')
  // A turn that emitted tool-call markup but never actually invoked a tool has
  // misfired: fail so the caller falls back instead of showing garbage.
  if (looksLikeFakedToolCall(raw) && tools.size === 0) {
    throw new Error('model emitted faked tool-call markup without invoking a tool')
  }

  return {
    answer: stripToolMarkup(raw),
    toolUsed: tools.size > 0,
    toolNames: [...tools],
  }
}
