/**
 * PRP-034 Sub-fase 3: proxy GET MC → daemon `/ops/recent?limit=N`.
 *
 * Backfill inicial para `/ops` antes de conectar al stream SSE. Degrada graceful
 * con `{ events: [] }` cuando daemon offline (UX no rota).
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const limit = url.searchParams.get('limit') ?? '200'
  return proxyToDaemon(req, {
    path: `/ops/recent?limit=${encodeURIComponent(limit)}`,
    method: 'GET',
    degradeOnNetworkError: { events: [] },
  })
}
