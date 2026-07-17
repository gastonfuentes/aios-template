/**
 * PRP-034 Sub-fase 6: POST /api/notifications/:id/read — marca como leída.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || !userData.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(userData.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('aios_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
