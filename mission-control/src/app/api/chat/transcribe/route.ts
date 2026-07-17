/**
 * Proxy MC → daemon AIOS para `POST /transcribe` (multipart audio → text).
 *
 * NO usa `proxyToDaemon` (helper canónico solo soporta JSON body). Implementa
 * el patrón base manualmente:
 *   1. Auth gate Supabase SSR (`createClient` → `getUser` → `isEmailAllowed`).
 *   2. Env validation fail-fast (`AGENT_URL` + `OPENCLAW_GATEWAY_TOKEN`).
 *   3. Forward del body multipart byte-exact al daemon `/transcribe` con
 *      `Authorization: Bearer <token>` + preservación del header `Content-Type`
 *      (boundary canónico del browser MediaRecorder).
 *   4. Manejo de fallos:
 *      - 503 propagado byte-exact cuando daemon retorna 503 (GROQ_API_KEY ausente).
 *      - 502 cuando daemon offline / network error.
 *      - 200 con `{ text }` byte-exact en happy path.
 *
 * Patrón canónico Praxis (PRP-031): Node runtime, multipart pass-through.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  // ─── 2. Env validation ──────────────────────────────────────────────────
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

  // ─── 3. Forward multipart byte-exact ────────────────────────────────────
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { error: 'invalid content-type', detail: 'expected multipart/form-data' },
      { status: 400 },
    )
  }

  let body: ArrayBuffer
  try {
    body = await req.arrayBuffer()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'body read failed', detail: msg }, { status: 400 })
  }

  let daemonRes: Response
  try {
    daemonRes = await fetch(`${agentUrl}/transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': contentType,
      },
      body,
      signal: req.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return new Response(null, { status: 499, statusText: 'Client Closed Request' })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'upstream fetch failed', detail: msg }, { status: 502 })
  }

  const text = await daemonRes.text().catch(() => '')
  return new Response(text || '{}', {
    status: daemonRes.status,
    headers: {
      'Content-Type': daemonRes.headers.get('content-type') ?? 'application/json',
    },
  })
}
