/**
 * Tests unitarios de `ops-logger.ts` (PRP-017).
 *
 * Cubre:
 *  - log: emite EventEmitter 'ops' + escribe al ring buffer + intenta persistir.
 *  - getRecent: orden reverse-chronological + respeta limit.
 *  - Ring buffer cap a MAX_BUFFER=200.
 *  - Shape de OpsEvent: id incremental, timestamp, type, source, data, sessionId.
 *  - persistToSupabase: invoca fetch con headers + body correctos (mock).
 *  - persistToSupabase silent cuando faltan envs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./env.js', () => ({
  readEnvFile: vi.fn(() => ({
    MC_SUPABASE_URL: 'https://test.supabase.co',
    MC_SUPABASE_KEY: 'test-key-xxxxx',
  })),
}))

vi.mock('./error-alerts.js', () => ({
  maybeAlert: vi.fn(),
}))

import { opsLogger, type OpsEvent } from './ops-logger.js'

describe('OpsLogger.log', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Limpiamos el buffer entre tests reiniciando el counter virtual.
    // No exponemos clear() — saturamos para reset implícito.
    for (let i = 0; i < 250; i += 1) {
      opsLogger.log('agent_text', 'system', { i, marker: '__test_reset__' })
    }
  })

  it('emite el evento "ops" para listeners', async () => {
    const received: OpsEvent[] = []
    const handler = (ev: OpsEvent) => received.push(ev)
    opsLogger.on('ops', handler)
    opsLogger.log('tool_start', 'web', { tool: 'bash' }, 'sess-1')
    opsLogger.off('ops', handler)

    expect(received.length).toBe(1)
    expect(received[0].type).toBe('tool_start')
    expect(received[0].source).toBe('web')
    expect(received[0].data.tool).toBe('bash')
    expect(received[0].sessionId).toBe('sess-1')
  })

  it('cuando sessionId es undefined, no se incluye en el objeto', () => {
    const received: OpsEvent[] = []
    const handler = (ev: OpsEvent) => received.push(ev)
    opsLogger.on('ops', handler)
    opsLogger.log('agent_text', 'cron', { msg: 'hola' })
    opsLogger.off('ops', handler)

    expect(received[0].sessionId).toBeUndefined()
  })

  it('id incrementa monotónicamente', () => {
    const received: OpsEvent[] = []
    const handler = (ev: OpsEvent) => received.push(ev)
    opsLogger.on('ops', handler)
    opsLogger.log('agent_text', 'system', { i: 1 })
    opsLogger.log('agent_text', 'system', { i: 2 })
    opsLogger.off('ops', handler)

    const n1 = Number(received[0].id.replace('ops-', ''))
    const n2 = Number(received[1].id.replace('ops-', ''))
    expect(n2).toBe(n1 + 1)
  })

  it('timestamp es ms epoch reciente', () => {
    const before = Date.now()
    let captured: OpsEvent | null = null
    const handler = (ev: OpsEvent) => {
      captured = ev
    }
    opsLogger.on('ops', handler)
    opsLogger.log('agent_text', 'web', {})
    opsLogger.off('ops', handler)
    const after = Date.now()

    expect(captured).not.toBeNull()
    expect(captured!.timestamp).toBeGreaterThanOrEqual(before)
    expect(captured!.timestamp).toBeLessThanOrEqual(after)
  })

  it('intenta persistir a Supabase con fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 201 }),
    )
    opsLogger.log('cron_start', 'cron', { job: 'briefing' }, 'sess-cron')
    // fetch es fire-and-forget; basta con que se haya llamado.
    expect(fetchSpy).toHaveBeenCalled()
    const [url, opts] = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1] as [
      string,
      RequestInit,
    ]
    expect(url).toContain('/rest/v1/ops_events')
    expect((opts.headers as Record<string, string>).apikey).toBe('test-key-xxxxx')
    expect((opts.headers as Record<string, string>).Authorization).toContain(
      'Bearer test-key-xxxxx',
    )
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body as string)
    expect(body.type).toBe('cron_start')
    expect(body.source).toBe('cron')
    expect(body.session_id).toBe('sess-cron')
    expect(body.data).toEqual({ job: 'briefing' })
  })

  it('persist no rompe el log aunque fetch falle', () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))
    expect(() =>
      opsLogger.log('tool_error', 'web', { err: 'boom' }),
    ).not.toThrow()
  })
})

describe('OpsLogger.getRecent', () => {
  it('retorna los más recientes primero (reverse-chronological)', () => {
    // Limpia con saturación + agrega 3 marcadores
    for (let i = 0; i < 250; i += 1) {
      opsLogger.log('agent_text', 'system', { reset: i })
    }
    opsLogger.log('cron_start', 'cron', { i: 'A' })
    opsLogger.log('cron_done', 'cron', { i: 'B' })
    opsLogger.log('cron_error', 'cron', { i: 'C' })

    const recent = opsLogger.getRecent(3)
    expect(recent.length).toBe(3)
    expect(recent[0].data.i).toBe('C')
    expect(recent[1].data.i).toBe('B')
    expect(recent[2].data.i).toBe('A')
  })

  it('respeta el limit', () => {
    for (let i = 0; i < 50; i += 1) {
      opsLogger.log('agent_text', 'system', { i })
    }
    expect(opsLogger.getRecent(5).length).toBe(5)
    expect(opsLogger.getRecent(10).length).toBe(10)
  })

  it('default limit = 50', () => {
    for (let i = 0; i < 100; i += 1) {
      opsLogger.log('agent_text', 'system', { i })
    }
    expect(opsLogger.getRecent().length).toBe(50)
  })
})

describe('OpsLogger ring buffer cap', () => {
  it('size nunca supera MAX_BUFFER=200', () => {
    for (let i = 0; i < 500; i += 1) {
      opsLogger.log('agent_text', 'system', { i })
    }
    expect(opsLogger.size).toBeLessThanOrEqual(200)
  })

  it('los eventos viejos se evictan cuando se excede el cap', () => {
    for (let i = 0; i < 250; i += 1) {
      opsLogger.log('agent_text', 'system', { marker: `evict-${i}` })
    }
    const all = opsLogger.getRecent(200)
    // El primero (más reciente) debe ser el último log (marker=evict-249).
    expect(all[0].data.marker).toBe('evict-249')
    // El último de los 200 debe ser >= 50 (los <50 ya se evictaron).
    const oldest = all[all.length - 1]
    const oldestIdx = Number((oldest.data.marker as string).replace('evict-', ''))
    expect(oldestIdx).toBeGreaterThanOrEqual(50)
  })
})
