/**
 * Always-push receiver: el daemon AIOS postea aquí fire-and-forget al cerrar
 * cada stream de `/chat/stream`, con bearer server-to-server.
 *
 * Wire byte-exact al `postBackgroundCompletion` del daemon
 * ([agent-server/src/server.ts:240-254](../../../../../agent-server/src/server.ts#L240-L254)):
 *
 *   POST /api/chat/complete
 *   Authorization: Bearer <MISSION_CONTROL_TOKEN | OPENCLAW_GATEWAY_TOKEN>
 *   Content-Type: application/json
 *   Body: {
 *     chatSessionId: string | null,
 *     userMessage: string,
 *     assistantMessage: string,
 *     audioUrl: string | null,
 *     clientWasConnected: boolean
 *   }
 *
 * Comportamiento:
 *   1. Valida bearer con `crypto.timingSafeEqual` contra `MISSION_CONTROL_TOKEN`
 *      con fallback a `OPENCLAW_GATEWAY_TOKEN` (espejando el daemon `server.ts:77`
 *      `MC_BACKEND_TOKEN = MISSION_CONTROL_TOKEN ?? MC_TOKEN`). Si falla → 401.
 *   2. Parsea body con Zod. Si falla → 400.
 *   3. Si `chatSessionId === null`, genera uno server-side (caso edge donde el
 *      frontend no pre-creó session).
 *   4. UPSERT a `chat_sessions` con title = primeros 60 chars del user message.
 *   5. INSERT dedup-checked a `chat_messages` (user + assistant rows) con
 *      metadata { source: 'web', clientWasConnected, audio_url, image_url }.
 *   6. Retorna 200 con { ok, chatSessionId }.
 *
 * Runtime: Node (NO Edge) — coherente con PRP-028 (Supabase service-role +
 * crypto.timingSafeEqual + bidi SSE).
 *
 * Auth model: cliente Supabase **service-role** (bypass RLS). El caller es el
 * daemon, sin sesión Supabase del operador. RLS owner-only sigue intacta en
 * el schema; el bypass via service-role es la salida canónica (PRP-029 doctrina).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { timingSafeEqual } from 'node:crypto'
import { randomUUID } from 'node:crypto'
import { createServiceClient } from '@/core/adapters/supabase/service'
import {
  upsertChatSession,
  insertChatMessages,
  type ChatMessageMetadata,
} from '@/features/chat/api/persistence'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CompletePayloadSchema = z.object({
  // chatSessionId puede ser:
  //   - UUID válido (caso canónico: frontend pre-creó session, lo manda byte-exact)
  //   - null (caso edge legacy: daemon postea sin session asignada → server-side genera UUID)
  // Rechazamos empty string explícitamente para evitar UUIDs ""  → Supabase reject silente.
  chatSessionId: z.union([z.string().uuid(), z.null()]),
  userMessage: z.string().min(1),
  assistantMessage: z.string().min(1),
  audioUrl: z.string().nullable().optional(),
  // PRP-031 Fase 4: imageUrl paralelo a audioUrl. URL firmado de Supabase
  // Storage `chat-attachments` bucket (TTL 7d). Se persiste a metadata.image_url.
  imageUrl: z.string().nullable().optional(),
  clientWasConnected: z.boolean(),
  // PRP-032 Sub-fase 5 — branching: parentMessageId apunta al USER message
  // que disparó la rama (las hermanas comparten parent). Cuando branch:true
  // en el adapter, este campo viaja al receiver. UUID válido o null.
  parentMessageId: z.union([z.string().uuid(), z.null()]).optional(),
  // PRP-032 Sub-fase 5 — branchIndex ordena cronológicamente. Default 0
  // (rama default cuando NO es regenerate). +1 por cada regenerate sobre
  // el mismo parent_message_id.
  branchIndex: z.number().int().nonnegative().optional(),
})

/**
 * Constant-time bearer comparison. Resistente a timing attacks (PRP-010 + PRP-028
 * aprendizajes canónicos).
 */
function isBearerValid(provided: string, expected: string): boolean {
  if (!expected) return false
  if (provided.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
}

export async function POST(req: Request): Promise<Response> {
  // ─── 1. Bearer ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  const expected =
    process.env.MISSION_CONTROL_TOKEN ??
    process.env.OPENCLAW_GATEWAY_TOKEN ??
    ''

  if (!isBearerValid(token, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ─── 2. Body ───────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const parsed = CompletePayloadSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid payload', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const payload = parsed.data
  const chatSessionId = payload.chatSessionId ?? randomUUID()

  // ─── 3. Supabase service-role ──────────────────────────────────────────
  let supabase: ReturnType<typeof createServiceClient>
  try {
    supabase = createServiceClient()
  } catch (err) {
    // Fail-soft: si SUPABASE_SERVICE_ROLE_KEY no está sembrado, retornar 503
    // con detail accionable. El daemon loguea + sigue (always-push es fire-
    // and-forget). El operador ve los mensajes en la UI pero el reload los
    // perderá hasta que se siembre la env.
    return NextResponse.json(
      {
        error: 'service unavailable',
        detail: 'supabase service-role not configured on MC',
        cause: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    )
  }

  // ─── 4. UPSERT chat_sessions ───────────────────────────────────────────
  try {
    await upsertChatSession(supabase, chatSessionId, payload.userMessage)
  } catch (err) {
    return NextResponse.json(
      {
        error: 'failed to upsert chat_sessions',
        cause: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }

  // ─── 5. INSERT chat_messages bi-row con dedup ──────────────────────────
  const metadata: ChatMessageMetadata = {
    source: 'web',
    clientWasConnected: payload.clientWasConnected,
    ...(payload.audioUrl ? { audio_url: payload.audioUrl } : {}),
    ...(payload.imageUrl ? { image_url: payload.imageUrl } : {}),
  }

  let inserted: { user: boolean; assistant: boolean }
  let assistantId: string | undefined
  try {
    const result = await insertChatMessages(
      supabase,
      chatSessionId,
      payload.userMessage,
      payload.assistantMessage,
      metadata,
      payload.parentMessageId
        ? {
            parentMessageId: payload.parentMessageId,
            ...(payload.branchIndex !== undefined ? { branchIndex: payload.branchIndex } : {}),
          }
        : undefined,
    )
    inserted = result.inserted
    assistantId = result.assistantId
  } catch (err) {
    return NextResponse.json(
      {
        error: 'failed to insert chat_messages',
        cause: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { ok: true, chatSessionId, inserted, ...(assistantId ? { assistantId } : {}) },
    { status: 200 },
  )
}
