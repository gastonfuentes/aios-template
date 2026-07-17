/**
 * Proxy helper compartido para las routes MC → daemon AIOS.
 *
 * Centraliza el patrón canónico (PRP-028 + PRP-029):
 *   1. Auth gate Supabase SSR (`createClient` → `getUser` → `isEmailAllowed`).
 *   2. Env validation fail-fast (`AGENT_URL` + `OPENCLAW_GATEWAY_TOKEN`).
 *   3. Forward a `${AGENT_URL}<path>` con `Authorization: Bearer <token>` server-to-server.
 *   4. Manejo de fallos:
 *      - `degradeWithEmptyOnNetworkError`: routes de listado (GET /sessions) que
 *        prefieren retornar `{}` + HTTP 200 cuando el daemon está offline (UX no rota).
 *      - default: forward del status del daemon (5xx → 5xx, 4xx → 4xx).
 *
 * NUNCA expone el bearer al browser. NUNCA loguea el token.
 *
 * Runtime canónico: `nodejs` (NO Edge — aprendizaje PRP-028 sobre Supabase SSR
 * cookies + bidi pass-through). Cada route que importa este helper también
 * declara `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export type ProxyOptions = {
  /** Path relativo al `AGENT_URL`, ej. `/sessions?limit=50` o `/newchat`. */
  path: string
  /** Verbo HTTP. PATCH/DELETE/PUT sumados en PRP-034 Sub-fase 2 para /schedule. */
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
  /** Body del request (forwarded as-is). Solo POST. */
  body?: string
  /**
   * Cuando hay fallo de red (daemon down) o response no-2xx que indique
   * upstream offline, retornar `JSON.stringify(value)` + HTTP 200 en lugar
   * de propagar 5xx. Útil para listas (sessions, sessions/:id/messages) que
   * deben degradar graceful en la UI.
   */
  degradeOnNetworkError?: unknown
  /** AbortSignal del request original (cancellation). */
  signal?: AbortSignal
}

export async function proxyToDaemon(req: Request, opts: ProxyOptions): Promise<Response> {
  // ─── 1. Auth gate ────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data, error: authErr } = await supabase.auth.getUser()
  if (authErr || !data.user || !data.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(data.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ─── 2. Env validation (fail fast) ───────────────────────────────────────
  const agentUrl = process.env.AGENT_URL
  const bearer = process.env.OPENCLAW_GATEWAY_TOKEN
  if (!agentUrl || !bearer) {
    return NextResponse.json(
      {
        error: 'misconfigured',
        detail: `missing env: ${!agentUrl ? 'AGENT_URL ' : ''}${!bearer ? 'OPENCLAW_GATEWAY_TOKEN' : ''}`.trim(),
      },
      { status: 500 },
    )
  }

  // ─── 3. Forward to daemon ────────────────────────────────────────────────
  const requestInit: RequestInit = {
    method: opts.method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    signal: opts.signal ?? req.signal,
  }
  if (opts.body) {
    ;(requestInit as RequestInit & { body: string }).body = opts.body
  }

  let daemonRes: Response
  try {
    daemonRes = await fetch(`${agentUrl}${opts.path}`, requestInit)
  } catch (err) {
    // AbortError del cliente: silencio.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new Response(null, { status: 499, statusText: 'Client Closed Request' })
    }
    // Network / DNS / connection refused: si el caller pide degradación, retornar
    // el shape vacío con HTTP 200. Si no, 502 con detail genérico.
    if (opts.degradeOnNetworkError !== undefined) {
      return NextResponse.json(opts.degradeOnNetworkError, { status: 200 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'upstream fetch failed', detail: msg }, { status: 502 })
  }

  // Daemon respondió pero con error 5xx que indica el daemon mismo está rotó:
  // si es lista degradable, también caer al fallback.
  if (!daemonRes.ok && opts.degradeOnNetworkError !== undefined && daemonRes.status >= 500) {
    return NextResponse.json(opts.degradeOnNetworkError, { status: 200 })
  }

  // Caso default: propagar status + body byte-exact.
  const text = await daemonRes.text().catch(() => '')
  return new Response(text || '{}', {
    status: daemonRes.status,
    headers: {
      'Content-Type': daemonRes.headers.get('content-type') ?? 'application/json',
    },
  })
}
