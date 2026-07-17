/**
 * PRP-034 Sub-fase 3: proxy SSE MC → daemon `/ops/stream`.
 *
 * Espejo del patrón canónico `/api/chat/stream` (PRP-028): Node runtime, auth
 * Supabase SSR via cookie (NO bearer — EventSource del browser no soporta
 * headers custom, whatwg/html#2177), bearer server-side al daemon, pipe directo
 * del body sin transformación.
 *
 * NOTA: `proxyToDaemon` helper NO sirve aquí porque consume body con `.text()`
 * (materializa el stream completo, rompe SSE bidi). Espejamos /api/chat/stream
 * con GET en vez de POST + sin body.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STREAM_HEADERS: HeadersInit = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
}

export async function GET(req: Request): Promise<Response> {
  // ─── 1. Auth gate (cookie Supabase SSR) ──────────────────────────────────
  const supabase = await createClient()
  const { data, error: authErr } = await supabase.auth.getUser()
  if (authErr || !data.user || !data.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(data.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // ─── 2. Env validation ────────────────────────────────────────────────────
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

  // ─── 3. Forward GET a daemon /ops/stream ──────────────────────────────────
  let daemonRes: Response
  try {
    daemonRes = await fetch(`${agentUrl}/ops/stream`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: 'text/event-stream',
      },
      signal: req.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new Response(null, { status: 499, statusText: 'Client Closed Request' })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'upstream fetch failed', detail: msg }, { status: 502 })
  }

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

  return new Response(daemonRes.body, {
    status: 200,
    headers: STREAM_HEADERS,
  })
}
