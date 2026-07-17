/**
 * LLMProvider interface canónica — PRP-037 Fase 1.
 *
 * Abstrae los 3 providers oficiales del template AIOS:
 *   - claude-code-sdk: harness `query()` async generator (preserva Memory Tool nativo + cwd-shared sessions).
 *   - anthropic-api:   Vercel AI SDK + `@ai-sdk/anthropic` (cross-provider control fino, sin Memory Tool nativo).
 *   - openrouter:      Vercel AI SDK + `@openrouter/ai-sdk-provider` (300+ modelos via una key).
 *
 * El daemon AIOS productivo arranca con `LLM_PROVIDER=claude-code-sdk` (default) y NO degrada
 * capabilities. El template del alumno arranca con el provider que él elija en la entrevista
 * BOOT.md. Capability flags exponen qué features están disponibles según el provider activo.
 *
 * Diseño:
 *  - `stream(input)`: AsyncGenerator que normaliza eventos SSE del provider a `NormalizedEvent`
 *    cross-provider. AI Elements en el MC consume `NormalizedEvent` ya mapeado a su shape de
 *    parts (text/reasoning/dynamic-tool/source-url).
 *  - `complete(input)`: one-shot non-streaming. Usado por `consolidate.ts` extractor + cualquier
 *    futuro batch-mode caller que NO necesite streaming.
 *  - Métodos de estado del modelo: `getCurrentModel/setCurrentModel/getAvailableModels`.
 *  - `getContextInfo`: tokens usados / total context window — para `/agent/context` endpoint.
 *  - `prewarm`: warm-up del subprocess CLI (solo claude-code-sdk; no-op en los otros).
 *  - Capability flags: el caller pregunta `supportsX()` antes de usar features provider-específicos.
 *
 * Convención de naming: el adapter NUNCA hardcodea "marley" — usa MEMORY_TABLE_PREFIX env
 * para nombrar la tabla + RPCs Supabase. Default `agent_memories` para el template; AIOS
 * productivo setea `MEMORY_TABLE_PREFIX=marley` para preservar branding.
 */

import type { OpsSource } from '../ops-logger.js'

// ─── Tipos compartidos del agent (re-exports desde el adapter) ──────────────

/**
 * `EffortLevel` espeja el tipo del SDK Claude Code. En anthropic-api / openrouter NO se mapea
 * 1-a-1 — se ignora (los otros providers no exponen este parámetro). El adapter lo acepta por
 * compat pero degrada silente si el provider activo no lo soporta.
 */
export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

/** Información de modelo disponible (espeja `ModelInfo` del SDK Claude Code). */
export interface ModelInfo {
  id: string
  displayName?: string
  contextWindow?: number
}

/** Resultado de runAgent (one-shot non-streaming) — backward-compat con `AgentResult` de agent.ts pre-refactor. */
export interface AgentResult {
  text: string | null
  newSessionId?: string
  slashCommands?: string[]
  isCompact?: boolean
  tokensBefore?: number
  tokensAfter?: number
  terminalReason?: string
}

// ─── NormalizedEvent — espejo cross-provider de SSE events ──────────────────

/**
 * Union exhaustivo de los eventos SSE que el adapter emite a su caller.
 * Espejo byte-exact del `SSEEvent` que vive en `mission-control/src/features/chat/contracts/messages.ts`
 * — el frontend MC valida con Zod safeParse + descarta unknowns con console.warn.
 *
 * Cada implementación del LLMProvider normaliza los eventos nativos del provider a este shape.
 * Algunos eventos solo aplican a ciertos providers (capability flags lo controlan).
 */
export type NormalizedEvent =
  | { type: 'init'; sessionId: string; slashCommands?: string[] }
  | { type: 'text_delta'; text: string }
  | { type: 'thinking_delta'; text: string }
  | { type: 'tool_start'; toolName: string; toolId: string }
  | { type: 'tool_input'; toolId: string; input: unknown }
  | { type: 'tool_output'; toolId: string; output: unknown; isError?: boolean }
  | { type: 'tool_done'; toolId: string }
  | { type: 'compact'; tokensBefore?: number; tokensAfter?: number }
  | {
      type: 'usage'
      costUsd: number
      inputTokens: number
      outputTokens: number
      durationMs: number
      numTurns: number
      model?: string
      contextUsed?: number
      contextTotal?: number
    }
  | { type: 'result'; text: string; terminalReason?: string }
  | { type: 'model_changed'; model: string }
  | { type: 'interrupt' }
  | { type: 'error'; message: string }

// ─── Input shapes ──────────────────────────────────────────────────────────

export interface StreamInput {
  /** Prompt del usuario (último mensaje de la conversación). */
  prompt: string
  /** Session id para resume (provider-específico — claude-code-sdk usa archivos `.jsonl`; los otros lo persisten en Supabase). */
  sessionId?: string
  /** Effort level para extended thinking. Mapeado por provider. Default: undefined (default del provider). */
  effort?: EffortLevel
  /** AbortSignal externo para cancelar el stream. */
  signal?: AbortSignal
  /** Source canonical para ops_events log (web / mc-web / cron / system / telegram / manual / housekeeping). */
  source?: OpsSource
  /** Override del modelo (espeja `setCurrentModel`). */
  modelOverride?: string
  /** Callback opcional para recibir handle del Query (claude-code-sdk solo; otros lo ignoran). */
  onQuery?: (q: unknown) => void
}

export interface CompleteInput {
  /** Prompt completo (sistema + user mezclados o ya serializados). */
  prompt: string
  /** Override del modelo para este call. Default: getCurrentModel(). */
  model?: string
  /** AbortSignal externo. */
  signal?: AbortSignal
  /** Source canonical para ops log. */
  source?: OpsSource
  /** Timeout en milisegundos. Default: AGENT_TIMEOUT_MS del config. */
  timeoutMs?: number
}

export interface CompleteResult {
  text: string
  usage?: {
    inputTokens: number
    outputTokens: number
    costUsd?: number
  }
  durationMs: number
}

// ─── Capability flags ──────────────────────────────────────────────────────

export interface ProviderCapabilities {
  /** Memory Tool nativo del SDK (solo claude-code-sdk). Los otros providers reimplementan en Supabase. */
  memoryToolNative: boolean
  /** Cwd-shared sessions persistidas en `~/.claude/projects/<slug>/*.jsonl`. Solo claude-code-sdk. */
  cwdSessions: boolean
  /** Extended thinking summarized con `thinking_delta` events. Soportado por providers Anthropic (Sonnet 4.6+, Opus 4.6+). */
  thinkingSummarized: boolean
  /** Tool use con `dynamic-tool` shape (input fragmentado + output via tool_result). Anthropic-style. */
  dynamicTools: boolean
  /** Pre-warm del subprocess CLI (solo claude-code-sdk). */
  prewarm: boolean
  /** `getAvailableModels()` dinámico desde el SDK. Solo claude-code-sdk; los otros retornan lista hardcoded. */
  dynamicModelList: boolean
}

// ─── LLMProvider interface ──────────────────────────────────────────────────

export interface LLMProvider {
  /** Nombre del provider para logs y debugging. */
  readonly name: 'claude-code-sdk' | 'anthropic-api' | 'openrouter'

  /** Capabilities del provider activo. */
  readonly capabilities: ProviderCapabilities

  // Streaming (chat productivo)
  stream(input: StreamInput): AsyncGenerator<NormalizedEvent>

  // One-shot non-streaming (extractor consolidate + futuros batch callers)
  complete(input: CompleteInput): Promise<CompleteResult>

  // Estado del modelo
  getCurrentModel(): string | null
  setCurrentModel(model: string): void
  getAvailableModels(sessionId?: string): Promise<ModelInfo[]>
  getContextInfo(): { used: number | null; total: number | null }

  // Lifecycle
  prewarm(): Promise<void>
  isPrewarmed(): boolean
}

// ─── Provider type discriminator (env-based) ─────────────────────────────────

export type LLMProviderName = 'claude-code-sdk' | 'anthropic-api' | 'openrouter'

/** Lista canónica para validación de env var. */
export const LLM_PROVIDER_NAMES: readonly LLMProviderName[] = [
  'claude-code-sdk',
  'anthropic-api',
  'openrouter',
] as const

export function isValidProviderName(s: string): s is LLMProviderName {
  return (LLM_PROVIDER_NAMES as readonly string[]).includes(s)
}
