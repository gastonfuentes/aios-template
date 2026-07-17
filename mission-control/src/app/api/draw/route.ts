/**
 * PRP-034 Sub-fase 4: GET /api/draw + POST /api/draw.
 *
 * - GET retorna la lista de canvases del operador (RLS owner-only filtra).
 * - POST crea un canvas nuevo con title default. Devuelve el row creado.
 *
 * Auth Supabase SSR + defense-in-depth `isEmailAllowed`.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  elements: z.array(z.unknown()).optional(),
  app_state: z.record(z.string(), z.unknown()).optional(),
  files: z.record(z.string(), z.unknown()).optional(),
})

export async function GET(): Promise<Response> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || !userData.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(userData.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('draw_canvases')
    .select('id, title, thumbnail_url, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ canvases: data ?? [] })
}

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || !userData.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(userData.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.message },
      { status: 400 },
    )
  }

  const { data, error } = await supabase
    .from('draw_canvases')
    .insert({
      title: parsed.data.title ?? 'Untitled',
      elements: parsed.data.elements ?? [],
      app_state: parsed.data.app_state ?? {},
      files: parsed.data.files ?? {},
      owner_id: userData.user.id,
    })
    .select('id, title, thumbnail_url, created_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ canvas: data }, { status: 201 })
}
