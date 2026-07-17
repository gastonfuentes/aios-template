/**
 * PRP-034 Sub-fase 4: GET / PATCH / DELETE /api/draw/:id.
 *
 * - GET retorna el canvas completo (elements + app_state + files).
 * - PATCH actualiza elements/app_state/files/title (auto-save desde el editor).
 * - DELETE elimina el canvas (RLS + ON DELETE CASCADE deja todo limpio).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UpdateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  elements: z.array(z.unknown()).optional(),
  app_state: z.record(z.string(), z.unknown()).optional(),
  files: z.record(z.string(), z.unknown()).optional(),
})

async function guard() {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || !userData.user.email) {
    return {
      supabase: null as never,
      response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }),
    }
  }
  if (!isEmailAllowed(userData.user.email)) {
    return {
      supabase: null as never,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    }
  }
  return { supabase, response: null }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const { supabase, response } = await guard()
  if (response) return response

  const { data, error } = await supabase
    .from('draw_canvases')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ canvas: data })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const { supabase, response } = await guard()
  if (response) return response

  const body = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.message },
      { status: 400 },
    )
  }
  const updateFields: Record<string, unknown> = {}
  if (parsed.data.title !== undefined) updateFields['title'] = parsed.data.title
  if (parsed.data.elements !== undefined) updateFields['elements'] = parsed.data.elements
  if (parsed.data.app_state !== undefined) updateFields['app_state'] = parsed.data.app_state
  if (parsed.data.files !== undefined) updateFields['files'] = parsed.data.files

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'no_fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('draw_canvases')
    .update(updateFields)
    .eq('id', id)
    .select('id, title, updated_at')
    .single()
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ canvas: data })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const { supabase, response } = await guard()
  if (response) return response

  const { error } = await supabase.from('draw_canvases').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id })
}
