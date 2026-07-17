/**
 * Proxy MC → daemon AIOS para `GET /models`.
 *
 * Daemon retorna `{ models: ModelInfo[], source: 'sdk' | 'cache' | 'fallback' }`
 * con los modelos disponibles del SDK Claude Code 0.2.128 (Opus 4.7 / Sonnet
 * 4.6 / Sonnet 1M / Haiku 4.5 / etc.). Cache 1h en el daemon — el listado
 * cambia raro y respeta cuota.
 *
 * Degradación graceful: si el daemon está offline o cae 5xx, retornar
 * el shape canónico fallback con HTTP 200 — el selector renderea sin error.
 *
 * Patrón canónico Praxis (PRP-028 + PRP-029 + PRP-030 + PRP-031):
 *   - Node runtime (NO Edge).
 *   - Auth Supabase SSR + isEmailAllowed (vía proxyToDaemon helper).
 *   - Bearer OPENCLAW_GATEWAY_TOKEN server-to-server.
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_RESPONSE = {
  models: [
    { value: 'default', displayName: 'Default (recommended)', description: 'Opus 4.7 — Most capable for complex work' },
    { value: 'sonnet', displayName: 'Sonnet', description: 'Sonnet 4.6 — Best for everyday tasks' },
    { value: 'haiku', displayName: 'Haiku', description: 'Haiku 4.5 — Fastest for quick answers' },
  ],
  source: 'fallback' as const,
}

export async function GET(req: Request): Promise<Response> {
  return proxyToDaemon(req, {
    path: '/models',
    method: 'GET',
    degradeOnNetworkError: FALLBACK_RESPONSE,
  })
}
