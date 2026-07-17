/**
 * Proxy MC → daemon AIOS para `GET /sessions?limit=N`.
 *
 * Daemon retorna `{ sessions: SDKSessionInfo[] }` enriquecido con
 * `linkedChatSessionId: string | null` por entrada (lookup reverso desde
 * SQLite `sessions` que mapea chat_id ↔ session_id del SDK).
 *
 * Degradación graceful: si el daemon está offline o cae 5xx, retornar
 * `{ sessions: [] }` + HTTP 200. La UI muestra empty state sin romperse.
 *
 * Patrón canónico Praxis (PRP-028 + PRP-029 + PRP-030):
 *   - Node runtime (NO Edge).
 *   - Auth Supabase SSR + isEmailAllowed.
 *   - Bearer OPENCLAW_GATEWAY_TOKEN server-to-server.
 *   - JSON shape forwarded byte-exact.
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const path = `/sessions${limitParam ? `?limit=${encodeURIComponent(limitParam)}` : ''}`

  return proxyToDaemon(req, {
    path,
    method: 'GET',
    degradeOnNetworkError: { sessions: [] },
  })
}
