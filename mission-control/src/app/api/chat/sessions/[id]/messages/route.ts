/**
 * Proxy MC → daemon AIOS para `GET /sessions/:id/messages`.
 *
 * Daemon delega a `getSessionMessages(sessionId, { dir: PROJECT_ROOT })` del
 * SDK Claude Code 0.2.128 que lee el `.jsonl` persistido en
 * `agent-server/store/sessions/<id>.jsonl`. Retorna
 * `{ messages: SessionMessage[] }`.
 *
 * Caso de uso Fase 3: NO consumido por el sidebar (el reload va por SSR
 * `loadSessionMessages` desde Supabase `chat_messages`). Queda cableado para
 * futuras fases (4-5) que necesiten leer el stream completo del SDK directo
 * (ej. mostrar contenido cuando la sesión nació en CLI/cron y NO pasó por
 * always-push, caso borde documentado en el PRP-030).
 *
 * Degradación graceful: si daemon offline → `{ messages: [] }` + HTTP 200.
 *
 * Next 16 App Router: `params` es Promise (await obligatorio).
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  const { id } = await ctx.params
  // Validación mínima: id es required y no-empty. UUID validation queda al daemon
  // (que retorna `{ messages: [] }` si no encuentra el archivo).
  if (!id || !id.trim()) {
    return new Response(JSON.stringify({ messages: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return proxyToDaemon(req, {
    path: `/sessions/${encodeURIComponent(id)}/messages`,
    method: 'GET',
    degradeOnNetworkError: { messages: [] },
  })
}
