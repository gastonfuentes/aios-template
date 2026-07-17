/**
 * Proxy SSE MC → daemon AIOS.
 *
 * Flow:
 *   browser → POST /api/chat/stream (con cookie Supabase)
 *           → [esta route] valida sesión + isEmailAllowed
 *           → POST <AGENT_URL>/chat/stream con Bearer OPENCLAW_GATEWAY_TOKEN
 *           → pipe SSE response del daemon de vuelta al browser
 *
 * Runtime: Node (NO Edge). Razón documentada en PRP-028: Supabase SSR cookies
 * + bidi SSE pass-through es robusto en Node; Vercel no buffea response
 * streams por default; Edge sería marginal y agrega risk de cookies SSR.
 *
 * Auth (defense-in-depth, además del layout gate de `(app)/layout.tsx`):
 *   1. Cookie Supabase SSR vía `createClient()` → `getUser()`.
 *   2. `isEmailAllowed(user.email)` matching contra `ALLOWED_EMAILS`.
 *   3. Si cualquiera falla → 401 JSON.
 *
 * Bearer: `OPENCLAW_GATEWAY_TOKEN` inyectado server-to-server hacia el daemon
 * (`AGENT_URL` ya cableado en `.env.local` byte-exact con agent-server/.env).
 * El proxy NUNCA expone el bearer al browser y NUNCA lo loguea.
 *
 * Cancellation: el `req.signal` se propaga al fetch del daemon. Si el browser
 * cierra la conexión (refresh, navigate away, abort del cliente), el fetch
 * abort llega al daemon que cancela la query SDK ("último gana" del daemon
 * intercepta cualquier query previa).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const dynamic = 'force-dynamic'

const STREAM_HEADERS: HeadersInit = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Disable nginx-style proxy buffering (Vercel, Cloudflare): vamos a flushear
  // cada `data: ...\n\n` frame al browser inmediatamente.
  'X-Accel-Buffering': 'no',
}

export async function POST(req: Request): Promise<Response> {
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
    // NUNCA loguear el bearer ni el agentUrl con secrets; solo el detail genérico.
    return NextResponse.json(
      {
        error: 'misconfigured',
        detail: `missing env: ${!agentUrl ? 'AGENT_URL ' : ''}${!bearer ? 'OPENCLAW_GATEWAY_TOKEN' : ''}`.trim(),
      },
      { status: 500 },
    )
  }

  // ─── 3. Read body once (re-stream a daemon) ──────────────────────────────
  let body: string
  try {
    body = await req.text()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  // ─── 4. Forward to daemon ────────────────────────────────────────────────
  let daemonRes: Response
  try {
    daemonRes = await fetch(`${agentUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: req.signal,
      // Edge-only flag `duplex: 'half'` no aplica en Node fetch — Node 18+ lo
      // soporta nativamente; omitir el option mantiene compat.
    })
  } catch (err) {
    // AbortError del cliente: silencio, retornar 499-like.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new Response(null, { status: 499, statusText: 'Client Closed Request' })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'upstream fetch failed', detail: msg }, { status: 502 })
  }

  // Propagate non-2xx desde el daemon como-is (status + body).
  if (!daemonRes.ok) {
    const errText = await daemonRes.text().catch(() => '')
    return new Response(errText || JSON.stringify({ error: 'daemon error' }), {
      status: daemonRes.status,
      headers: { 'Content-Type': daemonRes.headers.get('content-type') ?? 'text/plain' },
    })
  }

  if (!daemonRes.body) {
    return NextResponse.json({ error: 'daemon returned empty body' }, { status: 502 })
  }

  // ─── 5. Pipe SSE stream al browser ───────────────────────────────────────
  // El daemon ya emite `data: ...\n\n` frames + `data: [DONE]\n\n` terminator.
  // Pasamos el `ReadableStream` byte-exact al browser sin transformación.
  return new Response(daemonRes.body, {
    status: 200,
    headers: STREAM_HEADERS,
  })
}
