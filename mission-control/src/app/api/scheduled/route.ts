/**
 * PRP-034 Sub-fase 2: proxy MC → daemon `/schedule`.
 *
 *   GET  /api/scheduled         → list de scheduled_tasks.
 *   POST /api/scheduled         → crear cron job (body: { id, prompt, schedule }).
 *
 * Degrada graceful en GET cuando daemon offline (`{ tasks: [] }` + HTTP 200).
 * POST propaga el status del daemon byte-exact para que la UI muestre errores
 * de cron expression inválida (400 → invalid_cron) o id duplicado (409).
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  return proxyToDaemon(req, {
    path: '/schedule',
    method: 'GET',
    degradeOnNetworkError: { tasks: [] },
  })
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.text()
  return proxyToDaemon(req, {
    path: '/schedule',
    method: 'POST',
    body,
  })
}
