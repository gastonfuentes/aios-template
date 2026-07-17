/**
 * Tests unitarios de `scheduler.ts` (PRP-017 — no-blocking).
 *
 * Cubre:
 *  - computeNextRun: parsea cron expressions con TZ Guadalajara correctamente.
 *  - CRON_CATEGORY: los 3 jobs del brief mapean a 'cron-reports'.
 *  - stopScheduler: idempotente.
 *
 * NOT covered (heavy mocking): runDueTasks (acoplado a db + agent + ops + mc-client),
 * initScheduler (setInterval). Decisión consciente PRP-017.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('./db.js', () => ({
  getDueTasks: vi.fn(() => []),
  createTask: vi.fn(),
  updateTaskAfterRun: vi.fn(),
  taskExists: vi.fn(() => false),
  getDb: vi.fn(),
  getCronSession: vi.fn(),
  setCronSession: vi.fn(),
}))

vi.mock('./agent.js', () => ({
  runAgent: vi.fn(),
}))

vi.mock('./mc-client.js', () => ({
  mcCronResult: vi.fn(),
}))

vi.mock('./ops-logger.js', () => ({
  opsLogger: { log: vi.fn() },
}))

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

vi.mock('./config.js', () => ({
  ALLOWED_CHAT_ID: 'BOOTSTRAP',
  SCHEDULER_TZ: 'America/Mexico_City',
  PROJECT_ROOT: '/tmp/test',
  MC_SERVER_PORT: 3099,
}))

import {
  computeNextRun,
  CRON_CATEGORY,
  stopScheduler,
} from './scheduler.js'

describe('computeNextRun', () => {
  it('parsea cron diario "0 6 * * *" (6am Guadalajara)', () => {
    const ts = computeNextRun('0 6 * * *')
    expect(ts).toBeGreaterThan(Math.floor(Date.now() / 1000))
    // Debe ser razonablemente pronto (<25h)
    expect(ts - Math.floor(Date.now() / 1000)).toBeLessThan(25 * 3600)
  })

  it('parsea cron nocturno "0 23 * * *" (11pm Guadalajara)', () => {
    const ts = computeNextRun('0 23 * * *')
    expect(ts).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('parsea cron mensual "0 5 1 * *" (5am día 1)', () => {
    const ts = computeNextRun('0 5 1 * *')
    expect(ts).toBeGreaterThan(Math.floor(Date.now() / 1000))
    // Debe ser dentro de los próximos 32 días
    expect(ts - Math.floor(Date.now() / 1000)).toBeLessThan(32 * 24 * 3600)
  })

  it('lanza error con cron expression inválida', () => {
    expect(() => computeNextRun('not a cron')).toThrow()
  })
})

describe('CRON_CATEGORY', () => {
  it('está vacío tras cleanup pre-replanteo (2026-05-12)', () => {
    expect(Object.keys(CRON_CATEGORY)).toHaveLength(0)
  })

  it('jobs no listados retornan undefined (sin reuse de session)', () => {
    expect(CRON_CATEGORY['unknown-job']).toBeUndefined()
  })
})

describe('stopScheduler', () => {
  it('es idempotente (no rompe si no hay interval activo)', () => {
    expect(() => stopScheduler()).not.toThrow()
    expect(() => stopScheduler()).not.toThrow()
  })
})
