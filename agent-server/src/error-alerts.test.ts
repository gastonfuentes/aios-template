/**
 * Tests unitarios de `error-alerts.ts` (PRP-010 Tier B).
 *
 * Cubre:
 *  - filtro `shouldAlert` por sufijo `_error` o `rate_limit`.
 *  - throttle 60s por (type+source).
 *  - fail-soft cuando bot no está configurado o chat_id es BOOTSTRAP.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  configureErrorAlerts,
  maybeAlert,
  resetErrorAlertsThrottle,
} from './error-alerts.js'
import type { OpsEvent } from './ops-logger.js'

type FakeBot = {
  api: { sendMessage: ReturnType<typeof vi.fn> }
}

function buildEvent(overrides: Partial<OpsEvent> = {}): OpsEvent {
  return {
    id: 'ops-1',
    type: 'cron_error',
    timestamp: Date.now(),
    source: 'cron',
    data: { jobId: 'daily-briefing-6am', error: 'something exploded' },
    ...overrides,
  }
}

function buildFakeBot(): FakeBot {
  return { api: { sendMessage: vi.fn().mockResolvedValue({}) } }
}

describe('maybeAlert', () => {
  beforeEach(() => {
    resetErrorAlertsThrottle()
  })

  it('filtra: dispara para *_error', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => '12345' })
    maybeAlert(buildEvent({ type: 'cron_error' }))
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('filtra: dispara para rate_limit', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => '12345' })
    maybeAlert(buildEvent({ type: 'rate_limit' }))
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('filtra: NO dispara para cron_done / agent_text / etc.', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => '12345' })
    maybeAlert(buildEvent({ type: 'cron_done' }))
    maybeAlert(buildEvent({ type: 'agent_text' }))
    maybeAlert(buildEvent({ type: 'tool_start' }))
    expect(bot.api.sendMessage).not.toHaveBeenCalled()
  })

  it('throttle: segunda llamada en <60s con mismo (type+source) no dispara', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => '12345' })
    maybeAlert(buildEvent({ type: 'cron_error', source: 'cron' }))
    maybeAlert(buildEvent({ type: 'cron_error', source: 'cron' }))
    maybeAlert(buildEvent({ type: 'cron_error', source: 'cron' }))
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('throttle: distintos source no comparten cooldown', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => '12345' })
    maybeAlert(buildEvent({ type: 'tool_error', source: 'cron' }))
    maybeAlert(buildEvent({ type: 'tool_error', source: 'telegram' }))
    expect(bot.api.sendMessage).toHaveBeenCalledTimes(2)
  })

  it('fail-soft: sin bot configurado retorna sin error', () => {
    configureErrorAlerts({ botGetter: () => null, chatIdGetter: () => '12345' })
    expect(() => maybeAlert(buildEvent())).not.toThrow()
  })

  it('fail-soft: chat_id BOOTSTRAP no dispara (bootstrap mode)', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => 'BOOTSTRAP' })
    maybeAlert(buildEvent())
    expect(bot.api.sendMessage).not.toHaveBeenCalled()
  })

  it('fail-soft: chat_id vacío no dispara', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => '' })
    maybeAlert(buildEvent())
    expect(bot.api.sendMessage).not.toHaveBeenCalled()
  })

  it('formato HTML: mensaje incluye type, source, jobId, error', () => {
    const bot = buildFakeBot()
    configureErrorAlerts({ botGetter: () => bot as never, chatIdGetter: () => '12345' })
    maybeAlert(buildEvent({
      type: 'cron_error',
      source: 'cron',
      data: { jobId: 'daily-briefing-6am', error: 'connection timeout' },
    }))
    const [, text, opts] = bot.api.sendMessage.mock.calls[0] as [string, string, { parse_mode: string }]
    expect(text).toContain('cron_error')
    expect(text).toContain('source=cron')
    expect(text).toContain('daily-briefing-6am')
    expect(text).toContain('connection timeout')
    expect(opts.parse_mode).toBe('HTML')
  })
})
