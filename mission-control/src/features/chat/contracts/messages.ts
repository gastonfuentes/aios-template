/**
 * Contratos del chat MC ↔ daemon AIOS.
 *
 * `SSEEventSchema` es el espejo Zod byte-exact del union `SSEEvent` declarado en
 * [agent-server/src/agent.ts:81-101](../../../../agent-server/src/agent.ts#L81-L101)
 * — fuente de verdad operativa del wire del daemon. Si el daemon suma un evento
 * nuevo (ej. `thinking_delta`, `tool_input`, `tool_output` en Fases 2 / 5),
 * extender esta unión en ambos lados.
 *
 * `MessagePartSchema` es el shape que esperan los componentes AI Elements
 * (`Message`, `MessageContent`, `Reasoning`, `Sources`, `Tool`) cuando se les
 * pasa `message.parts[]`. El adapter `useAgentChat` traduce `SSEEvent` →
 * `MessagePart` en runtime.
 *
 * El adapter usa `SSEEventSchema.safeParse(...)` por evento (no `.parse(...)`)
 * — patrón canónico para wire protocols evolutivos: si un evento desconocido
 * llega antes de sumar su variante al schema, el adapter loguea + descarta
 * sin romper el stream.
 */

import { z } from 'zod'

// ─── SSEEvent espejo byte-exact del daemon ──────────────────────────────────

export const SSEInitSchema = z.object({
  type: z.literal('init'),
  sessionId: z.string(),
  slashCommands: z.array(z.string()).optional(),
})

export const SSETextDeltaSchema = z.object({
  type: z.literal('text_delta'),
  text: z.string(),
})

export const SSEToolStartSchema = z.object({
  type: z.literal('tool_start'),
  toolName: z.string(),
  toolId: z.string(),
})

// PRP-032 Sub-fase 2 — thinking summarized del SDK Claude Code. Espejo byte-exact
// del SSEEvent thinking_delta del daemon (agent-server/src/agent.ts).
export const SSEThinkingDeltaSchema = z.object({
  type: z.literal('thinking_delta'),
  text: z.string(),
})

// PRP-032 Sub-fase 3 — input parseado del tool_use, emitido UNA vez tras acumular
// input_json_delta fragmentado al content_block_stop. `input` puede ser cualquier
// shape JSON-serializable (objetos típicos: {file_path}, {command}, {query}, etc.)
// o `{ _raw: string }` cuando el JSON falla parse.
export const SSEToolInputSchema = z.object({
  type: z.literal('tool_input'),
  toolId: z.string(),
  input: z.unknown(),
})

// PRP-032 Sub-fase 3 — output del tool_result del SDK. `output` mantiene shape
// canónica de Anthropic API (string o array de bloques tipo `{type, text?, ...}`).
// `isError` opcional cuando el tool falla (error UI state).
export const SSEToolOutputSchema = z.object({
  type: z.literal('tool_output'),
  toolId: z.string(),
  output: z.unknown(),
  isError: z.boolean().optional(),
})

export const SSEToolDoneSchema = z.object({
  type: z.literal('tool_done'),
  toolId: z.string(),
})

export const SSECompactSchema = z.object({
  type: z.literal('compact'),
  tokensBefore: z.number().optional(),
  tokensAfter: z.number().optional(),
})

export const SSEUsageSchema = z.object({
  type: z.literal('usage'),
  costUsd: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  durationMs: z.number(),
  numTurns: z.number(),
  model: z.string().optional(),
  contextUsed: z.number().optional(),
  contextTotal: z.number().optional(),
})

export const SSEResultSchema = z.object({
  type: z.literal('result'),
  text: z.string(),
  terminalReason: z.string().optional(),
})

export const SSEModelChangedSchema = z.object({
  type: z.literal('model_changed'),
  model: z.string(),
})

export const SSEInterruptSchema = z.object({
  type: z.literal('interrupt'),
})

export const SSEErrorSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
})

export const SSEEventSchema = z.discriminatedUnion('type', [
  SSEInitSchema,
  SSETextDeltaSchema,
  SSEThinkingDeltaSchema,
  SSEToolStartSchema,
  SSEToolInputSchema,
  SSEToolOutputSchema,
  SSEToolDoneSchema,
  SSECompactSchema,
  SSEUsageSchema,
  SSEResultSchema,
  SSEModelChangedSchema,
  SSEInterruptSchema,
  SSEErrorSchema,
])

export type SSEEvent = z.infer<typeof SSEEventSchema>

// ─── MessagePart shape que esperan AI Elements ──────────────────────────────

/**
 * Estado del tool call en el lifecycle visual del componente `Tool`:
 *   - input-streaming: el daemon emitió `tool_start`, esperando inputs/outputs
 *   - input-available: tenemos el input (Fase 5 lo poblará)
 *   - output-available: el daemon emitió `tool_done`
 *   - output-error: el tool falló
 */
export type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export const TextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const ReasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
})

/**
 * Convención canónica Vercel AI SDK (`DynamicToolUIPart`): `type: 'dynamic-tool'`
 * + `toolName: string` separado. Esto preserva el discriminated union de
 * `MessagePart` (TypeScript narrow por literal `type`) sin perder el nombre
 * del tool. El componente `Tool` de AI Elements ya consume este shape via
 * union `ToolUIPart | DynamicToolUIPart`. Para nuestros tools dinámicos del
 * SDK Claude Code (Bash/Read/Edit/etc.) usamos siempre dynamic-tool.
 */
export const ToolPartSchema = z.object({
  type: z.literal('dynamic-tool'),
  toolName: z.string(),
  toolCallId: z.string(),
  state: z.union([
    z.literal('input-streaming'),
    z.literal('input-available'),
    z.literal('output-available'),
    z.literal('output-error'),
  ]),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
})

export const SourceUrlPartSchema = z.object({
  type: z.literal('source-url'),
  url: z.string(),
  title: z.string().optional(),
})

/**
 * Part de imagen attached al mensaje (PRP-031). Usado tanto live (preview en
 * el textarea antes de enviar) como en hidratación SSR (reload `?session=<uuid>`
 * lee `chat_messages.metadata.image_url` y lo construye como esta part).
 *
 * El `mediaType` es opcional pero útil para el render (badge "Imagen" /
 * "Audio" / "Documento"); se infiere del Content-Type del Storage si falta.
 */
export const ImageUrlPartSchema = z.object({
  type: z.literal('image-url'),
  url: z.string(),
  mediaType: z.string().optional(),
  alt: z.string().optional(),
})

/**
 * Part de audio attached (paralelo a image-url, mismo origen Storage signed URL).
 */
export const AudioUrlPartSchema = z.object({
  type: z.literal('audio-url'),
  url: z.string(),
  mediaType: z.string().optional(),
})

export const MessagePartSchema = z.discriminatedUnion('type', [
  TextPartSchema,
  ReasoningPartSchema,
  ToolPartSchema,
  SourceUrlPartSchema,
  ImageUrlPartSchema,
  AudioUrlPartSchema,
])

export type TextPart = z.infer<typeof TextPartSchema>
export type ReasoningPart = z.infer<typeof ReasoningPartSchema>
export type ToolPart = z.infer<typeof ToolPartSchema>
export type SourceUrlPart = z.infer<typeof SourceUrlPartSchema>
export type ImageUrlPart = z.infer<typeof ImageUrlPartSchema>
export type AudioUrlPart = z.infer<typeof AudioUrlPartSchema>
export type MessagePart = z.infer<typeof MessagePartSchema>

// ─── Message ────────────────────────────────────────────────────────────────

export const MessageRoleSchema = z.union([
  z.literal('user'),
  z.literal('assistant'),
  z.literal('system'),
])
export type MessageRole = z.infer<typeof MessageRoleSchema>

export const MessageSchema = z.object({
  id: z.string(),
  role: MessageRoleSchema,
  parts: z.array(MessagePartSchema),
  createdAt: z.string().datetime().optional(),
  // PRP-032 Sub-fase 5 — branching. Solo populado para assistant messages que
  // son regenerate-children del mismo user message. Hermanas comparten
  // `parentMessageId` (apunta al user msg que las disparó) + se ordenan por
  // `branchIndex`. Cuando un assistant message tiene parentMessageId, el render
  // del ChatPage lo agrupa con sus hermanas en un `<MessageBranch>` selector.
  parentMessageId: z.string().nullable().optional(),
  branchIndex: z.number().int().nonnegative().optional(),
})

export type Message = z.infer<typeof MessageSchema>

// ─── Estado del hook useAgentChat ──────────────────────────────────────────

export type ChatStatus = 'idle' | 'streaming' | 'error'

// ─── Sentinel del wire SSE ──────────────────────────────────────────────────

/** Marker que el daemon escribe al cerrar el stream. */
export const SSE_DONE_MARKER = '[DONE]'

// ─── /sessions del daemon (PRP-030) ─────────────────────────────────────────

/**
 * Espejo Zod del `SDKSessionInfo` que retorna `listSessions` del SDK Claude
 * Code 0.2.128 (ver agent-server/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts:3198-3239)
 * + el campo `linkedChatSessionId` que el daemon agrega via lookup reverso
 * desde SQLite `sessions` (ver agent-server/src/server.ts:392-422).
 *
 * Validación lax (la mayoría de campos optional) — el SDK puede agregar campos
 * en upgrades futuros sin romper el adapter MC.
 */
export const SDKSessionInfoSchema = z.object({
  sessionId: z.string(),
  summary: z.string(),
  lastModified: z.number(),
  fileSize: z.number().optional(),
  customTitle: z.string().optional(),
  firstPrompt: z.string().optional(),
  gitBranch: z.string().optional(),
  cwd: z.string().optional(),
  tag: z.string().optional(),
  createdAt: z.number().optional(),
  /** PRP-030: el daemon agrega este campo. `null` cuando no hay match en SQLite `sessions`. */
  linkedChatSessionId: z.union([z.string(), z.null()]).optional(),
})

export type SDKSessionInfo = z.infer<typeof SDKSessionInfoSchema>

export const SessionsResponseSchema = z.object({
  sessions: z.array(SDKSessionInfoSchema),
})

export type SessionsResponse = z.infer<typeof SessionsResponseSchema>

/**
 * Item denormalizado para render en el sidebar (PRP-030). Combina datos del
 * daemon (`SDKSessionInfo`) + override de título desde Supabase `chat_sessions`
 * cuando hay match por `linkedChatSessionId === id`.
 */
export type ChatHistoryItem = {
  /** sessionId del SDK (UUID) — usado como `key` React + reload via daemon. */
  sdkSessionId: string
  /** chatSessionId del MC (UUID) o null. Cuando no es null, el item es navegable a `/ai-agent?session=<chatSessionId>`. */
  chatSessionId: string | null
  /** Título a mostrar (Supabase title si match, fallback al `customTitle/summary` del SDK). */
  title: string
  /** Timestamp en ms epoch de la última modificación. */
  lastModifiedMs: number
  /** Working directory de la sesión SDK (para tagging CLI). */
  cwd?: string
  /** Git branch al final de la sesión SDK. */
  gitBranch?: string
}
