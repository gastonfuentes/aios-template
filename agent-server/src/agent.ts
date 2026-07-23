/**
 * Facade del adapter LLM cross-provider — PRP-037 Fase 1.
 *
 * Re-exporta la API pública histórica de este archivo (pre-PRP-037: wrap directo del SDK
 * Claude Code) pero ahora delegando al `LLMProvider` activo según env `LLM_PROVIDER`:
 *   - claude-code-sdk (default) → preserva AIOS productivo byte-exact.
 *   - anthropic-api / openrouter → providers cross-provider para alumnos del template.
 *
 * Backward compat de exports:
 *   - Types: `Query` (re-exported del SDK Claude Code; usado por `server.ts:onQuery` callback),
 *     `ModelInfo`, `EffortLevel`, `OpsSource`, `AgentResult`, `SSEEvent`.
 *   - Funciones: `getCurrentModel`, `setCurrentModel`, `getContextInfo`, `isSdkPrewarmed`,
 *     `prewarm`, `runAgentStream`, `runAgent`, `getAvailableModels`.
 *
 * Los callers existentes (`server.ts`, `bot.ts`, `index.ts`) NO necesitan cambios — la facade
 * preserva las firmas exactas. El refactor es transparente.
 */

import type { Query } from '@anthropic-ai/claude-agent-sdk'
import { selectProvider } from './llm-adapter/index.js'
import type {
  AgentResult,
  EffortLevel,
  ModelInfo,
  NormalizedEvent,
} from './llm-adapter/types.js'
import { AGENT_TIMEOUT_MS } from './config.js'
import type { OpsSource } from './ops-logger.js'

export type { Query, ModelInfo, EffortLevel, OpsSource, AgentResult }

/** SSEEvent — alias backward-compat de NormalizedEvent del adapter. */
export type SSEEvent = NormalizedEvent

// ─── Estado del modelo (delega al provider activo) ──────────────────────────

export function getCurrentModel(): string | null {
  return selectProvider().getCurrentModel()
}

export function setCurrentModel(model: string): void {
  selectProvider().setCurrentModel(model)
}

export function getContextInfo(): { used: number | null; total: number | null } {
  return selectProvider().getContextInfo()
}

export function isSdkPrewarmed(): boolean {
  return selectProvider().isPrewarmed()
}

/**
 * Pre-warm del provider activo. Para claude-code-sdk: warm-up del subprocess CLI.
 * Para anthropic-api / openrouter: no-op (no hay subprocess que precalentar).
 */
export async function prewarm(): Promise<void> {
  await selectProvider().prewarm()
}

// ─── runAgentStream (stream productivo del chat) ────────────────────────────

export async function* runAgentStream(
  message: string,
  sessionId?: string,
  signal?: AbortSignal,
  effort?: EffortLevel,
  onQuery?: (q: Query) => void,
  source: OpsSource = 'web',
): AsyncGenerator<SSEEvent> {
  const provider = selectProvider()
  // `onQuery` solo aplica al provider claude-code-sdk (handle del Query async generator
  // para invocar `.interrupt()` o `.supportedModels()` desde el caller). Los otros providers
  // lo ignoran silenciosamente — el caller usa `signal` para cancelación universal.
  const streamGen = provider.stream({
    prompt: message,
    ...(sessionId !== undefined ? { sessionId } : {}),
    ...(signal !== undefined ? { signal } : {}),
    ...(effort !== undefined ? { effort } : {}),
    source,
    ...(onQuery !== undefined ? { onQuery: onQuery as (q: unknown) => void } : {}),
  })
  for await (const event of streamGen) {
    yield event
  }
}

// ─── runAgent (one-shot non-streaming) ──────────────────────────────────────

export async function runAgent(
  message: string,
  sessionId?: string,
  onTyping?: () => void,
  source: OpsSource = 'web',
  timeoutMs?: number,
): Promise<AgentResult> {
  const provider = selectProvider()
  const typingInterval = onTyping ? setInterval(onTyping, 4000) : null
  const effectiveTimeout = timeoutMs ?? AGENT_TIMEOUT_MS

  try {
    const result = await provider.complete({
      prompt: message,
      source,
      timeoutMs: effectiveTimeout,
      ...(sessionId !== undefined ? { sessionId } : {}),
    })
    // Encadenar la sesión: preferí la que devuelve el provider (el turno real que
    // corrió); si no vino, echoá la de entrada. Sin esto el bot de Telegram no
    // avanza la sesión y cada mensaje pierde la memoria del anterior.
    const nextSessionId = result.sessionId ?? sessionId
    return {
      text: result.text,
      ...(nextSessionId !== undefined ? { newSessionId: nextSessionId } : {}),
      isCompact: false,
    }
  } finally {
    if (typingInterval) clearInterval(typingInterval)
  }
}

// ─── getAvailableModels ─────────────────────────────────────────────────────

export async function getAvailableModels(sessionId?: string): Promise<ModelInfo[]> {
  return selectProvider().getAvailableModels(sessionId)
}
