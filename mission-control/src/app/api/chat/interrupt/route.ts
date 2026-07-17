/**
 * Proxy MC → daemon AIOS para `POST /chat/interrupt`.
 *
 * Body: vacío. El daemon aborta la query SDK activa via
 * `activeQuery.interrupt()`. Si no hay query activa, retorna `{ ok: true }`
 * silente (idempotente).
 *
 * Caso de uso Fase 3 → Fase 4-5:
 *   - El hook `useAgentChat.interrupt()` (PRP-028 base) hoy hace fire-and-forget
 *     a esta route. Antes del PRP-030 retornaba 404 silente porque la route NO
 *     existía. Este PRP cierra el hueco con la route real.
 *
 * Degradación: si daemon offline → 503 con detail. El stop-button del UI
 * muestra spinner residual brevemente; aceptable.
 *
 * Patrón canónico Praxis (PRP-028 + PRP-030).
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  return proxyToDaemon(req, {
    path: '/chat/interrupt',
    method: 'POST',
    body: '{}',
  })
}
