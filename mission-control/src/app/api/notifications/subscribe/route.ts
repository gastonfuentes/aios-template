/**
 * PRP-034 Sub-fase 6: POST /api/notifications/subscribe.
 *
 * Recibe `{ subscription: PushSubscriptionJSON }` desde el cliente PWA y lo
 * persiste a la tabla `push_subscriptions` (heredada del template, shape
 * canónico { user_id, endpoint, keys_p256dh, keys_auth }).
 *
 * UPSERT por endpoint (`endpoint` es UNIQUE).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }),
})

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
  const parsed = SubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.message },
      { status: 400 },
    )
  }

  const { endpoint, keys } = parsed.data.subscription
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userData.user.id,
      endpoint,
      keys_p256dh: keys.p256dh,
      keys_auth: keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user || !userData.user.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  if (!isEmailAllowed(userData.user.email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint')
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 })
  }

  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  return NextResponse.json({ ok: true })
}
