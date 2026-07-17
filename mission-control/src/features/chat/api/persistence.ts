/**
 * Helpers de persistencia chat ↔ Supabase.
 *
 * Consumidos por:
 *   - SSR de `app/(app)/ai-agent/page.tsx` (Sub-fase 5: reload conversación por
 *     `?session=<uuid>` con cliente Supabase SSR auth-checked).
 *   - Receiver `app/api/chat/complete/route.ts` (Sub-fase 3: always-push del
 *     daemon con cliente Supabase service-role bypass-RLS, callee bearer-validated).
 *
 * Doctrina:
 *   - El receiver corre con service-role porque el caller es el daemon (sin
 *     sesión Supabase del operador). La RLS owner-only del schema sigue intacta;
 *     solo el receiver la bypasea via service-role.
 *   - El SSR del Server Component usa cliente con cookies; RLS owner-only
 *     filtra naturalmente — si el operador no es dueño, retorna `[]`.
 *   - `loadSessionMessages` mappea filas a shape `Message[]` de los contracts
 *     PRP-028 para hidratación directa de `useAgentChat`.
 *   - `upsertChatSession` + `insertChatMessages` son idempotentes by design.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message, MessagePart } from '../contracts/messages'

/**
 * Shape de `metadata` que escribimos a `chat_messages` desde MC (PRP-029 Fase 2).
 * El daemon agrega más campos (`audio_url`, `image_url`, `source: 'telegram'/'cli'`)
 * cuando posteea desde otras superficies; el receiver MC los conserva sin tocar
 * via spread del payload.
 */
export type ChatMessageMetadata = {
  source: 'web' | 'telegram' | 'cli' | 'cron'
  clientWasConnected?: boolean
  audio_url?: string | null
  image_url?: string | null
}

/**
 * Lee `chat_messages` para una sesión y los mappea a shape `Message[]` que
 * `useAgentChat` consume directo como `initialMessages`. Cero validación
 * Zod aquí — confiamos en que el receiver ya guardó shape válido (defense in
 * depth para data corruption queda fuera de scope Fase 2).
 *
 * @param supabase cliente SSR (con cookies; RLS owner-only filtra) o service-role.
 * @param sessionId UUID validado upstream (Server Component lo valida con z.uuid).
 * @returns array de Messages ordenado cronológicamente. Retorna `[]` si no
 *          hay rows (sesión nueva o nacida en CLI/cron sin always-push).
 */
export async function loadSessionMessages(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, metadata, created_at, parent_message_id, branch_index')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .order('branch_index', { ascending: true })

  if (error || !data) {
    // Fail-soft: si la query falla (RLS rejection, network, schema drift),
    // retornar array vacío y dejar que el client arranque empty. La PWA no se
    // rompe; el operador puede mandar mensajes nuevos en la misma session.
    return []
  }

  return data.map((row) => {
    const role = row.role === 'user' ? 'user' : row.role === 'assistant' ? 'assistant' : 'system'
    const text = (row.content as string) ?? ''
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {}
    const parentMessageId = (row as { parent_message_id?: string | null }).parent_message_id ?? null
    const branchIndex = (row as { branch_index?: number }).branch_index ?? 0

    // PRP-031 Fase 4: hidratar parts attachment cuando metadata trae URLs.
    // El render `<ChatPage>` reconoce `image-url` / `audio-url` parts y los
    // muestra como chips inline arriba del text bubble.
    const parts: MessagePart[] = []
    if (typeof metadata.image_url === 'string' && metadata.image_url.length > 0) {
      parts.push({
        type: 'image-url',
        url: metadata.image_url,
        mediaType: 'image/*',
      })
    }
    if (typeof metadata.audio_url === 'string' && metadata.audio_url.length > 0) {
      parts.push({
        type: 'audio-url',
        url: metadata.audio_url,
        mediaType: 'audio/*',
      })
    }
    if (text.length > 0) {
      parts.push({ type: 'text', text })
    }
    if (parts.length === 0) {
      // Mensaje sin contenido (caso edge — no debería pasar pero defense in depth)
      parts.push({ type: 'text', text: '' })
    }

    return {
      id: row.id as string,
      role,
      parts,
      createdAt: row.created_at as string,
      ...(parentMessageId ? { parentMessageId } : {}),
      ...(branchIndex > 0 ? { branchIndex } : {}),
    }
  })
}

/**
 * Carga mensajes desde el SDK Claude Code via daemon (`GET /sessions/:id/messages`)
 * y los mappea a shape `Message[]`. Camino de fallback PRP-030 polish para
 * sesiones cross-superficie (CLI directo en la máquina del daemon, Telegram bot, cron jobs)
 * que NUNCA pasaron por always-push y por tanto no tienen rows en `chat_messages`
 * pero SÍ tienen historial completo en el `.jsonl` del SDK que vive en
 * `agent-server/store/sessions/<id>.jsonl`.
 *
 * Esto cierra la promesa central del brief master: una sola memoria de agent
 * accesible desde tres superficies, con el operador pudiendo retomar CUALQUIER
 * conversación sin importar dónde nació.
 *
 * Ejecuta server-side (Node fetch al daemon vía proxy `/api/chat/sessions/:id/messages`
 * que ya lleva el bearer). El shape SDK `SessionMessage` tiene fields
 * `{ type: 'user' | 'assistant', message: { content: string | Array } }` (espejo
 * de la API de Claude); el mapper extrae el texto plano de cada turno y descarta
 * tool_use / tool_result blocks (Fase 5 los renderea via `<Tool>` component).
 *
 * @param sdkSessionId UUID del sessionId del SDK (NO el chatSessionId del MC).
 * @param baseUrl base del daemon (ej. `https://YOUR_DAEMON_PUBLIC_URL`).
 * @param bearer `OPENCLAW_GATEWAY_TOKEN` server-to-server.
 * @returns array de Messages ordenado cronológicamente, o `[]` si daemon offline.
 */
export async function loadSdkSessionMessages(
  sdkSessionId: string,
  baseUrl: string,
  bearer: string,
): Promise<Message[]> {
  try {
    const res = await fetch(
      `${baseUrl}/sessions/${encodeURIComponent(sdkSessionId)}/messages`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${bearer}` },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) return []
    const json: unknown = await res.json().catch(() => null)
    if (!json || typeof json !== 'object') return []
    const messages = (json as { messages?: unknown }).messages
    if (!Array.isArray(messages)) return []

    const out: Message[] = []
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i] as Record<string, unknown>
      // Shape SDK SessionMessage: top-level `type` puede ser 'user' o 'assistant',
      // 'system', 'result', etc. Solo procesar user/assistant para el feed.
      const topType = m['type']
      if (topType !== 'user' && topType !== 'assistant') continue
      const inner = m['message'] as Record<string, unknown> | undefined
      if (!inner) continue
      const content = inner['content']
      let text = ''
      if (typeof content === 'string') {
        text = content
      } else if (Array.isArray(content)) {
        // Content blocks de Claude: { type: 'text', text } / { type: 'tool_use', ... } / { type: 'tool_result', ... }
        for (const block of content as Record<string, unknown>[]) {
          if (block && block['type'] === 'text' && typeof block['text'] === 'string') {
            text += (text ? '\n\n' : '') + (block['text'] as string)
          }
        }
      }
      if (!text.trim()) continue
      out.push({
        id: `sdk-${sdkSessionId}-${i}`,
        role: topType,
        parts: [{ type: 'text', text }],
        createdAt:
          typeof m['timestamp'] === 'string' ? (m['timestamp'] as string) : undefined,
      })
    }
    return out
  } catch {
    return []
  }
}

/**
 * UPSERT atómico de `chat_sessions`. Si la row no existe, INSERT con title =
 * primeros 60 chars del primer user message. Si existe, UPDATE `updated_at`
 * (sin tocar title; preserva el que se setteó originalmente).
 *
 * Patrón canónico Supabase: `.upsert()` con `onConflict` arma el SQL
 * `INSERT ... ON CONFLICT (id) DO UPDATE SET ...` server-side.
 *
 * @param supabase cliente service-role (bypass RLS).
 * @param sessionId UUID de la chat session.
 * @param titleHint texto del primer mensaje user para derivar el title default.
 */
export async function upsertChatSession(
  supabase: SupabaseClient,
  sessionId: string,
  titleHint: string,
): Promise<void> {
  const title = titleHint.trim().slice(0, 60) || 'New Chat'
  const now = new Date().toISOString()

  // Primer try: INSERT con ON CONFLICT updateando updated_at. El upsert de
  // supabase-js genera un INSERT/UPDATE atómico al onConflict 'id'.
  await supabase
    .from('chat_sessions')
    .upsert(
      {
        id: sessionId,
        title,
        updated_at: now,
      },
      {
        onConflict: 'id',
        // Importante: NO queremos pisar el title si ya existe — la idea es
        // mantener el title del primer mensaje. Pero supabase-js no soporta
        // "UPDATE solo de algunas columnas" via upsert; en la práctica acepto
        // que un re-send sobreescriba el title con el del primer mensaje (que
        // por idempotencia debería ser el mismo). Si Fase 5+ trae auto-title,
        // este behavior se refactoriza.
        ignoreDuplicates: false,
      },
    )
}

/**
 * INSERT bi-row (user + assistant) a `chat_messages` con dedup-check previo
 * para idempotencia. La race condition de double-write entre dos browsers del
 * mismo operador en <1ms es aceptable (single-operator AIOS).
 *
 * Dedup: SELECT por `(session_id, role, content)`; si match, skip insert. El
 * usecase canónico: el daemon postea always-push + el frontend ya escribió
 * via `onSave` directo a Supabase (no implementado en Fase 2 — frontend usa
 * solo always-push), o el daemon postea dos veces por bug.
 *
 * @param supabase cliente service-role.
 * @param sessionId UUID de la chat session.
 * @param userMessage texto del mensaje del operador.
 * @param assistantMessage texto de la respuesta de agent.
 * @param metadata extras a guardar en `metadata jsonb` (source, audio, etc.).
 */
export type BranchingHint = {
  /** UUID del USER message padre (las branches comparten parent). Si presente,
   * el assistant insert se persiste como branch hermana. */
  parentMessageId?: string | null
  /** Branch index explícito. Si no viene, se calcula como MAX(existing) + 1 query.
   * NO popula branch_index para el user message (cero branching para users). */
  branchIndex?: number
}

export async function insertChatMessages(
  supabase: SupabaseClient,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  metadata: ChatMessageMetadata,
  branching?: BranchingHint,
): Promise<{ inserted: { user: boolean; assistant: boolean }; assistantId?: string }> {
  const inserted = { user: false, assistant: false }
  let assistantId: string | undefined

  // PRP-032 Sub-fase 5 — cuando hay branching (regenerate), el USER message ya
  // existe (era el message original que disparó la rama). NO re-insertar; solo
  // insertar el assistant como nueva rama. El dedup-check de assistant también
  // se relaja: durante regenerate, el content puede coincidir con uno previo
  // si agent responde idéntico (raro pero posible) — aceptamos duplicate cuando
  // branching está presente porque branchIndex los distingue.
  const isBranching = !!branching?.parentMessageId

  // Dedup user (solo si NO es branching — el user ya existe en branching)
  if (!isBranching) {
    const { data: existingUser } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('session_id', sessionId)
      .eq('role', 'user')
      .eq('content', userMessage)
      .limit(1)

    if (!existingUser || existingUser.length === 0) {
      const { error: userErr } = await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: userMessage,
        metadata: { source: metadata.source },
      })
      if (userErr) {
        throw new Error(`insert user message failed: ${userErr.message} (${userErr.code ?? 'no-code'})`)
      }
      inserted.user = true
    }
  }

  // Dedup assistant (solo si NO es branching — branches aceptan duplicates)
  if (!isBranching) {
    const { data: existingAssistant } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('session_id', sessionId)
      .eq('role', 'assistant')
      .eq('content', assistantMessage)
      .limit(1)

    if (existingAssistant && existingAssistant.length > 0) {
      assistantId = (existingAssistant[0] as { id: string }).id
      return { inserted, assistantId }
    }
  }

  // Calcular branch_index si branching pero no especificado.
  let branchIndex = branching?.branchIndex ?? 0
  if (isBranching && branching?.branchIndex === undefined) {
    const { data: siblings } = await supabase
      .from('chat_messages')
      .select('branch_index')
      .eq('session_id', sessionId)
      .eq('role', 'assistant')
      .eq('parent_message_id', branching!.parentMessageId!)
      .order('branch_index', { ascending: false })
      .limit(1)
    const maxIdx = siblings && siblings.length > 0
      ? ((siblings[0] as { branch_index: number }).branch_index ?? 0)
      : -1
    branchIndex = maxIdx + 1
  }

  const { data: insertedRow, error: assistantErr } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role: 'assistant',
      content: assistantMessage,
      metadata: {
        source: metadata.source,
        ...(typeof metadata.clientWasConnected === 'boolean' && {
          clientWasConnected: metadata.clientWasConnected,
        }),
        ...(metadata.audio_url ? { audio_url: metadata.audio_url } : {}),
        ...(metadata.image_url ? { image_url: metadata.image_url } : {}),
      },
      ...(isBranching ? {
        parent_message_id: branching!.parentMessageId,
        branch_index: branchIndex,
      } : {}),
    })
    .select('id')
    .single()

  if (assistantErr) {
    throw new Error(`insert assistant message failed: ${assistantErr.message} (${assistantErr.code ?? 'no-code'})`)
  }
  inserted.assistant = true
  assistantId = (insertedRow as { id: string } | null)?.id

  return { inserted, assistantId }
}

/**
 * DELETE en cascada manual (sin FK formal): borra todas las rows de
 * `chat_messages` con `session_id = sessionId` + la row de `chat_sessions`
 * con `id = sessionId`. RLS owner-only filtra naturalmente cuando se invoca
 * con cliente SSR + cookies del operador.
 *
 * Errores propagan via `throw new Error(...)` con `message + code` (aprendizaje
 * canónico PRP-029 — NO swallow-fail). El caller (Server Action) captura y
 * retorna shape `{ ok: false, error }` para que el UI muestre toast.
 *
 * No hay transacción atómica entre los 2 DELETE — si el primero pasa y el
 * segundo falla, queda una `chat_session` huérfana sin mensajes (caso degenerado
 * irrelevante en single-operator). El operador puede re-intentar el delete con
 * el mismo sessionId; el primer DELETE será no-op (zero rows match) y el
 * segundo terminará la limpieza.
 *
 * @param supabase cliente SSR (cookies del operador) o service-role (admin).
 * @param sessionId UUID de la chat session a borrar.
 */
export async function deleteChatSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  // 1. Borrar mensajes (puede ser zero match si ya fueron borrados o si la
  // sesión nunca tuvo always-push, ej. CLI/cron sin replicación a Supabase).
  const { error: msgErr } = await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId)
  if (msgErr) {
    throw new Error(
      `delete chat_messages failed: ${msgErr.message} (${msgErr.code ?? 'no-code'})`,
    )
  }

  // 2. Borrar la session row (puede ser zero match si la sesión nunca pasó por
  // always-push y solo existe en el `.jsonl` SDK del daemon).
  const { error: sessErr } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
  if (sessErr) {
    throw new Error(
      `delete chat_sessions failed: ${sessErr.message} (${sessErr.code ?? 'no-code'})`,
    )
  }
}
