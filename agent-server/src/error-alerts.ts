/**
 * Alertas runtime via Telegram (PRP-010 Tier B mejora).
 *
 * Cuando el daemon emite un `OpsEvent` con `type` que termina en `_error` o
 * que es `rate_limit`, mandamos un mensaje al chat del operador para que se
 * entere sin tener que abrir `/ops` o leer logs locales.
 *
 * Diseño:
 * - Fire-and-forget. NUNCA bloquea el flujo del logger.
 * - Throttling por tipo de error: máximo 1 alerta cada 60s por (type+source).
 *   Sin esto, si el cron tira `cron_error` 100 veces seguidas (loop), spamea
 *   el chat y deja el bot rate-limited de Telegram.
 * - Fail-soft: si el bot no está configurado o falla `sendMessage`, log y
 *   sigue. El loop `OpsEvent → persistir → emit` no se afecta.
 * - Importa el bot via fn getter para evitar circular dep con `ops-logger`.
 */

import type { Bot } from 'grammy'
import { logger } from './logger.js'
import type { OpsEvent } from './ops-logger.js'

const THROTTLE_MS = 60_000
const lastSentByKey = new Map<string, number>()

let getBotInstance: (() => Bot | null) | null = null
let getAllowedChatId: (() => string) | null = null

/**
 * Wireado desde `index.ts` post-bot init para evitar circular dep
 * `ops-logger → bot → ops-logger`. Si el bot no se configura, queda null.
 */
export function configureErrorAlerts(opts: {
  botGetter: () => Bot | null
  chatIdGetter: () => string
}): void {
  getBotInstance = opts.botGetter
  getAllowedChatId = opts.chatIdGetter
  logger.info('error-alerts wired to bot')
}

function shouldAlert(type: string): boolean {
  return type.endsWith('_error') || type === 'rate_limit'
}

function buildMessage(event: OpsEvent): string {
  const ts = new Date(event.timestamp).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  })
  const data = event.data ?? {}
  const errorMsg = String(data['error'] ?? '').slice(0, 600)
  const jobId = String(data['jobId'] ?? '')
  const tool = String(data['tool'] ?? '')
  const lines = [
    `🚨 <b>${event.type}</b>`,
    `<i>${ts} · source=${event.source}</i>`,
  ]
  if (jobId) lines.push(`job: <code>${jobId}</code>`)
  if (tool) lines.push(`tool: <code>${tool}</code>`)
  if (errorMsg) lines.push('', `<pre>${escapeHtml(errorMsg)}</pre>`)
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function maybeAlert(event: OpsEvent): void {
  if (!shouldAlert(event.type)) return
  if (!getBotInstance || !getAllowedChatId) return

  const bot = getBotInstance()
  const chatId = getAllowedChatId()
  if (!bot || !chatId || chatId === 'BOOTSTRAP') return

  const key = `${event.type}::${event.source}`
  const now = Date.now()
  const last = lastSentByKey.get(key) ?? 0
  if (now - last < THROTTLE_MS) return
  lastSentByKey.set(key, now)

  const text = buildMessage(event)
  void bot.api
    .sendMessage(chatId, text, { parse_mode: 'HTML' })
    .catch((err: unknown) => {
      logger.warn({ err: String(err), type: event.type }, 'error-alert send failed')
    })
}

/** Para tests + reset entre runs. */
export function resetErrorAlertsThrottle(): void {
  lastSentByKey.clear()
}
