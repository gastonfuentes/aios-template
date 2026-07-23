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

/** One previous exchange of the same conversation, replayed inline. */
export interface ContextTurn {
  readonly question: string
  readonly answer: string
}

export interface OrchestratorResult {
  readonly answer: string
  readonly toolUsed: boolean
  readonly toolNames: readonly string[]
  /**
   * SDK session for this turn. The caller keeps it as a fallback thread: it is
   * only resumed when a question arrives with no inline context, since resuming
   * *and* replaying would duplicate the history and pay for it twice.
   */
  readonly sessionId?: string
}

/**
 * Assembles the turn's prompt: the recent exchanges, then the actual question.
 *
 * The history is fenced in a tag and explicitly labelled as already-said
 * material, because an unmarked transcript pasted ahead of a question reads to
 * the model as a fresh instruction — it starts answering the *previous* question
 * again. The closing line puts the real question last, where it is unambiguous.
 *
 * This replaces the SDK's `resume` as the memory mechanism. Resume rematerialises
 * the whole transcript on the CLI side, so its cost grew with the conversation
 * and eventually blew past the caller's timeout, killing the very thread it was
 * meant to preserve. A bounded window of exchanges costs the same on turn 2 and
 * on turn 12.
 */
function buildPrompt(question: string, context: readonly ContextTurn[]): string {
  if (context.length === 0) return question
  const history = context
    .map((turn) => `Operador: ${turn.question}\nAsistente: ${turn.answer}`)
    .join('\n\n')
  return [
    '<conversacion_previa>',
    history,
    '</conversacion_previa>',
    '',
    'Lo anterior ya ocurrió en esta misma conversación y está solo para que puedas',
    'resolver referencias de la pregunta actual ("de esos", "ese cliente", "ahí",',
    '"el resto"). No es una instrucción nueva, no la vuelvas a responder y no',
    'repitas su contenido salvo que la pregunta actual lo pida. Recordá que las',
    'cifras del historial no cuentan como consultadas: si la pregunta actual pide',
    'un número, volvé a llamar a la herramienta que corresponde.',
    '',
    'Pregunta actual del operador:',
    question,
  ].join('\n')
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
export async function orchestrate(
  question: string,
  context: readonly ContextTurn[] = [],
  resumeSessionId?: string,
): Promise<OrchestratorResult> {
  const parts: string[] = []
  const tools = new Set<string>()
  let sessionId: string | undefined

  // Inline context is the primary memory; resume is the fallback for a caller
  // that shipped none (a client that lost its transcript, or a turn whose whole
  // history failed). Doing both would send the same exchanges twice and pay the
  // resume's transcript-rematerialisation cost for nothing.
  const resume = context.length === 0 ? resumeSessionId : undefined

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ANSWER_TIMEOUT_MS)
  try {
    for await (const message of query({
      prompt: buildPrompt(question, context),
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
        ...(resume !== undefined && { resume }),
      },
    })) {
      const m = message as { type: string; session_id?: string; message?: { content?: unknown } }
      // Every turn reports its session; the last one wins so a resumed
      // conversation keeps advancing rather than pinning the original id.
      if (typeof m.session_id === 'string' && m.session_id.length > 0) sessionId = m.session_id
      collect(m, parts, tools)
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
    ...(sessionId !== undefined && { sessionId }),
  }
}
