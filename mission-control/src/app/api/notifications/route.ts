/**
 * PRP-034 Sub-fase 6: GET /api/notifications — lista de aios_notifications.
 *
 * Auth + RLS owner-only filtra. Soporta `?limit=` (default 50).
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || !userData.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(userData.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200)

  const { data, error } = await supabase
    .from('aios_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ notifications: data ?? [] })
}
