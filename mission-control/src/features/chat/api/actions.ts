'use server'

/**
 * Server Actions del feature `chat` (PRP-030).
 *
 * Patrón canónico Praxis Next 16 App Router:
 *   - `'use server'` directive.
 *   - Cliente Supabase SSR (cookies del operador) → RLS owner-only filtra.
 *   - Defense-in-depth: `getUser()` + `isEmailAllowed(user.email)` antes de
 *     cualquier mutación (el `(app)/layout.tsx` ya gates pero la Server Action
 *     puede ser invocada desde formularios o `useTransition` sin pasar por el
 *     layout — defensa redundante intencional).
 *   - Errores tipados via `{ ok: true } | { ok: false, error: string }`. El UI
 *     consume el shape sin try/catch (más limpio que throw).
 *   - `revalidatePath` después de mutaciones que afectan SSR (`/ai-agent`).
 *
 * NO usar service-role aquí — el operador es dueño de las rows. Si por algún
 * motivo el operador deja de ser owner (refactor multi-usuario futuro), el
 * RLS bloquea automáticamente. Service-role queda reservado para webhooks
 * server-to-server (always-push receiver, PRP-029).
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'
import { deleteChatSession } from './persistence'

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Borra una conversación: `chat_messages WHERE session_id = X` + `chat_sessions
 * WHERE id = X` + best-effort `POST /newchat` al daemon para limpiar el SDK
 * mapping en SQLite.
 *
 * El best-effort al newchat es fire-and-forget desde el server: si el daemon
 * está offline, se loguea pero no rompe el delete. La sesión SDK `.jsonl` queda
 * como huérfana hasta que el housekeeping nightly del daemon la limpie
 * (`>90d AND <5KB` — patrón canónico vivo, ver agent-server/src/housekeeping.ts).
 *
 * @param sessionId UUID de la chat session.
 * @returns `{ ok: true }` o `{ ok: false, error }`.
 */
export async function deleteSessionAction(sessionId: string): Promise<ActionResult> {
  if (!sessionId || typeof sessionId !== 'string') {
    return { ok: false, error: 'sessionId requerido' }
  }

  // ─── 1. Auth gate (defense-in-depth) ────────────────────────────────────
  const supabase = await createClient()
  const { data, error: authErr } = await supabase.auth.getUser()
  if (authErr || !data.user || !data.user.email) {
    return { ok: false, error: 'no autenticado' }
  }
  if (!isEmailAllowed(data.user.email)) {
    return { ok: false, error: 'no autorizado' }
  }

  // ─── 2. DELETE en Supabase (RLS owner-only filtra) ──────────────────────
  try {
    await deleteChatSession(supabase, sessionId)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }

  // ─── 3. Best-effort: limpiar SDK mapping del daemon ─────────────────────
  // El daemon mantiene una tabla SQLite `sessions(chat_id, session_id)`. Si no
  // limpiamos, queda apuntando a un sessionId SDK cuya `.jsonl` quedará huérfana
  // hasta el housekeeping nightly. NO bloquea el delete si falla (red caída,
  // timeout) — solo logueamos.
  const agentUrl = process.env.AGENT_URL
  const bearer = process.env.OPENCLAW_GATEWAY_TOKEN
  if (agentUrl && bearer) {
    try {
      await fetch(`${agentUrl}/newchat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearer}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatSessionId: sessionId }),
        // 5s timeout via AbortController para no colgar el response del action
        // si el daemon está degradado.
        signal: AbortSignal.timeout(5000),
      })
    } catch {
      // Fail-soft: el delete de Supabase ya pasó. La huérfana se limpia con
      // el housekeeping nightly. NO escalamos al UI.
    }
  }

  // ─── 4. Revalidar SSR del chat ──────────────────────────────────────────
  revalidatePath('/ai-agent')

  return { ok: true }
}

/**
 * Limpia la sesión actual del SDK del daemon (best-effort) sin tocar Supabase.
 * Caso de uso: botón `+` del sidebar "Nueva conversación" antes del
 * `router.push('/ai-agent')` para que el próximo mensaje arranque limpio del SDK.
 *
 * Si `chatSessionId` viene `undefined`, el daemon usa fallback `'mc-web'` (ver
 * agent-server/src/server.ts:454-465).
 */
export async function newChatAction(chatSessionId?: string): Promise<ActionResult> {
  // ─── Auth gate (defense-in-depth) ───────────────────────────────────────
  const supabase = await createClient()
  const { data, error: authErr } = await supabase.auth.getUser()
  if (authErr || !data.user || !data.user.email) {
    return { ok: false, error: 'no autenticado' }
  }
  if (!isEmailAllowed(data.user.email)) {
    return { ok: false, error: 'no autorizado' }
  }

  const agentUrl = process.env.AGENT_URL
  const bearer = process.env.OPENCLAW_GATEWAY_TOKEN
  if (!agentUrl || !bearer) {
    return { ok: false, error: 'daemon no configurado' }
  }

  try {
    const res = await fetch(`${agentUrl}/newchat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chatSessionId ? { chatSessionId } : {}),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return { ok: false, error: `daemon ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}
