/**
 * Proxy MC → daemon AIOS para `POST /newchat`.
 *
 * Body opcional: `{ chatSessionId?: string }`. Si se omite, el daemon usa
 * `SESSION_KEY_FALLBACK` (literal `'mc-web'`). El daemon ejecuta
 * `clearSession(chatSessionId)` que es un `DELETE FROM sessions WHERE chat_id = ?`
 * en SQLite (ver agent-server/src/db.ts:116). Cualquier string es válido —
 * UUID v4 funciona idéntico al literal `mc-web` o `telegram`.
 *
 * Caso de uso Fase 3:
 *   - Botón `+` "Nueva conversación" del sidebar limpia la SDK session activa.
 *   - Server Action `deleteSessionAction` lo invoca antes del DELETE en
 *     Supabase para limpiar el SDK mapping del daemon (best-effort).
 *
 * Degradación: si daemon offline → 503 con detail accionable (NO degrada
 * silente; el caller debe saber que la limpieza falló para mostrar feedback).
 *
 * Patrón canónico Praxis (PRP-028 + PRP-030).
 */

import { proxyToDaemon } from '@/features/chat/api/proxy-helper'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request): Promise<Response> {
  let body: string
  try {
    body = await req.text()
  } catch {
    body = '{}'
  }
  // Validar JSON opcional sin romper si está vacío o malformado.
  if (body.trim()) {
    try {
      JSON.parse(body)
    } catch {
      // Body malformado: forwarding al daemon que también es tolerante (default
      // a {}). Sin spam de error al cliente.
      body = '{}'
    }
  } else {
    body = '{}'
  }

  return proxyToDaemon(req, {
    path: '/newchat',
    method: 'POST',
    body,
    // NO degradeOnNetworkError: si el daemon está abajo, el caller necesita
    // saberlo (escala c1 desde la UI con toast).
  })
}
