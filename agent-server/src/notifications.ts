/**
 * PRP-034 — Helper de notifications del daemon.
 *
 * Cubre dos casos:
 *   1. `emitNotification` — Sub-fase 6: insert a `aios_notifications` Supabase
 *      via service-role + opcionalmente envía push web a CADA subscription
 *      registrada en `push_subscriptions` (tabla dedicada heredada del template,
 *      shape canónico { user_id, endpoint, keys_p256dh, keys_auth }).
 *   2. `sendOpenUrlPush` — Sub-fase 4: variante minimal que envía SOLO push con
 *      el URL como deeplink (sin row en `aios_notifications` — es navegacional).
 *      Consumido por `POST /open-url { target: 'push' | 'both' }`.
 *
 * Mapeo Sub-fase 6 reveló:
 *   - La tabla `notifications` heredada del template ya existe con shape distinto
 *     (mentioned_agent_id, content, delivered) — se renombró nuestra tabla a
 *     `aios_notifications`.
 *   - La tabla `push_subscriptions` también ya existe con 2 rows — la reusamos
 *     en lugar de crear `profiles.push_subscription jsonb`.
 *
 * Fail-soft completo: si VAPID keys no están sembradas, retorna 'skipped' + log
 * warn. Si Supabase service-role no está sembrado, `emitNotification` falla con
 * 'failed' + log error.
 */

import webpush from 'web-push'
import { logger } from './logger.js'
import { readEnvFile } from './env.js'

type EmitResult = 'sent' | 'skipped' | 'failed'

const env = readEnvFile([
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_EMAIL',
  'MC_SUPABASE_URL',
  'MC_SUPABASE_SERVICE_ROLE',
])

let vapidConfigured = false
function configureVapidOnce(): boolean {
  if (vapidConfigured) return true
  const pub = env['VAPID_PUBLIC_KEY']
  const priv = env['VAPID_PRIVATE_KEY']
  const mailto = env['VAPID_EMAIL']
  if (!pub || !priv || !mailto) {
    logger.warn('VAPID keys not configured — push notifications disabled')
    return false
  }
  try {
    webpush.setVapidDetails(mailto, pub, priv)
    vapidConfigured = true
    return true
  } catch (err) {
    logger.error({ err }, 'failed to configure VAPID')
    return false
  }
}

type PushSubscriptionRow = {
  endpoint: string
  keys_p256dh: string
  keys_auth: string
}

/**
 * Obtiene TODAS las PushSubscriptions registradas (multi-dispositivo).
 * AIOS single-operator: cada device del operador es una row distinta.
 */
async function fetchAllSubscriptions(): Promise<PushSubscriptionRow[]> {
  const url = env['MC_SUPABASE_URL']
  const key = env['MC_SUPABASE_SERVICE_ROLE']
  if (!url || !key) return []
  try {
    const res = await fetch(
      `${url}/rest/v1/push_subscriptions?select=endpoint,keys_p256dh,keys_auth`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      },
    )
    if (!res.ok) {
      logger.warn({ status: res.status }, 'fetchAllSubscriptions non-ok')
      return []
    }
    return (await res.json()) as PushSubscriptionRow[]
  } catch (err) {
    logger.error({ err }, 'fetchAllSubscriptions failed')
    return []
  }
}

function toWebpushSubscription(row: PushSubscriptionRow): webpush.PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.keys_p256dh,
      auth: row.keys_auth,
    },
  }
}

async function sendToAll(payload: Record<string, unknown>): Promise<EmitResult> {
  if (!configureVapidOnce()) return 'skipped'
  const subs = await fetchAllSubscriptions()
  if (subs.length === 0) return 'skipped'
  let anySent = false
  let anyFailed = false
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(toWebpushSubscription(sub), JSON.stringify(payload))
        anySent = true
      } catch (err) {
        logger.error({ err }, 'push send to subscription failed')
        anyFailed = true
      }
    }),
  )
  if (anySent) return 'sent'
  if (anyFailed) return 'failed'
  return 'skipped'
}

/**
 * Send push with a deeplink URL. Used by `POST /open-url { target: push | both }`.
 */
export async function sendOpenUrlPush(url: string): Promise<EmitResult> {
  return sendToAll({
    title: 'AIOS',
    body: 'Tienes un dibujo nuevo listo',
    url,
    tag: 'open-url',
  })
}

export type NotificationSeverity = 'info' | 'warn' | 'error' | 'success'

/**
 * Sub-fase 6: emitir notificación operativa.
 *
 * (a) INSERT a `aios_notifications` Supabase (service-role bypass-RLS).
 * (b) Si hay subscriptions, envía push web con `{ title, body, link?, tag }`
 *     a CADA dispositivo del operador.
 *
 * Devuelve `{ inserted, pushed }` para que el caller pueda logear.
 */
export async function emitNotification(opts: {
  title: string
  body?: string
  severity?: NotificationSeverity
  link?: string
  ownerId?: string
}): Promise<{ inserted: boolean; pushed: EmitResult }> {
  const supabaseUrl = env['MC_SUPABASE_URL']
  const supabaseKey = env['MC_SUPABASE_SERVICE_ROLE']

  let inserted = false
  if (supabaseUrl && supabaseKey) {
    try {
      let ownerId = opts.ownerId
      if (!ownerId) {
        const profileRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?select=id&limit=1`,
          {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          },
        )
        if (profileRes.ok) {
          const rows = (await profileRes.json()) as Array<{ id: string }>
          ownerId = rows[0]?.id
        }
      }
      if (ownerId) {
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/aios_notifications`, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            title: opts.title,
            body: opts.body ?? null,
            severity: opts.severity ?? 'info',
            link: opts.link ?? null,
            owner_id: ownerId,
          }),
        })
        inserted = insertRes.ok
        if (!insertRes.ok) {
          logger.warn(
            { status: insertRes.status, body: await insertRes.text() },
            'emitNotification insert non-ok',
          )
        }
      }
    } catch (err) {
      logger.error({ err }, 'emitNotification insert failed')
    }
  }

  const pushed = await sendToAll({
    title: opts.title,
    body: opts.body ?? '',
    url: opts.link,
    tag: 'aios-notification',
  })

  return { inserted, pushed }
}
