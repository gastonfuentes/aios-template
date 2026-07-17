/**
 * PRP-034 Sub-fase 2: proxy MC → daemon `/schedule/:id`.
 *
 *   PATCH  /api/scheduled/:id   → editar prompt/schedule.
 *   DELETE /api/scheduled/:id   → borrar cron job.
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  const body = await req.text()
  return proxyToDaemon(req, {
    path: `/schedule/${encodeURIComponent(id)}`,
    method: 'PATCH',
    body,
  })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  return proxyToDaemon(req, {
    path: `/schedule/${encodeURIComponent(id)}`,
    method: 'DELETE',
  })
}
