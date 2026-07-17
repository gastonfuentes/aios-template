import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params
  return proxyToDaemon(req, {
    path: `/schedule/${encodeURIComponent(id)}/resume`,
    method: 'POST',
  })
}
