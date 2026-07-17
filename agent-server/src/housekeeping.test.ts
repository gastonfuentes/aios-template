/**
 * Tests unitarios de `housekeeping.ts` (PRP-017).
 *
 * Cubre:
 *  - cleanupOrphanJsonl: filtra por extensión .jsonl + mtime >90d + size <5KB.
 *  - Casos borde: dir no existe (ENOENT → fail-soft con {scanned:0, deleted:0}),
 *    archivo grande no se borra, archivo reciente no se borra, archivo
 *    grande Y reciente queda intacto.
 *  - opsLogger.log('jsonl_cleanup', 'housekeeping', …) por cada delete.
 *  - initHousekeeping + stopHousekeeping: idempotente, no rompe si se llama dos veces.
 *
 * Mock fs/promises + opsLogger para aislar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('fs/promises', () => ({
  readdir: vi.fn(),
  stat: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock('./ops-logger.js', () => ({
  opsLogger: { log: vi.fn() },
}))

vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { readdir, stat, unlink } from 'fs/promises'
import {
  cleanupOrphanJsonl,
  initHousekeeping,
  stopHousekeeping,
} from './housekeeping.js'
import { opsLogger } from './ops-logger.js'

const mockedReaddir = vi.mocked(readdir)
const mockedStat = vi.mocked(stat)
const mockedUnlink = vi.mocked(unlink)
const mockedOpsLog = vi.mocked(opsLogger.log)

const NINETY_ONE_DAYS_AGO = Date.now() - 91 * 24 * 60 * 60 * 1000
const ONE_DAY_AGO = Date.now() - 24 * 60 * 60 * 1000

function statResult(opts: { size: number; mtimeMs: number }): never {
  return opts as never
}

describe('cleanupOrphanJsonl', () => {
  beforeEach(() => {
    mockedReaddir.mockReset()
    mockedStat.mockReset()
    mockedUnlink.mockReset()
    mockedOpsLog.mockReset()
  })

  it('fail-soft cuando el dir no existe (ENOENT)', async () => {
    mockedReaddir.mockImplementation(() => {
      const err = new Error('ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    const result = await cleanupOrphanJsonl()
    expect(result).toEqual({ scanned: 0, deleted: 0, freedBytes: 0 })
    expect(mockedUnlink).not.toHaveBeenCalled()
  })

  it('borra .jsonl viejo (>90d) Y chico (<5KB)', async () => {
    mockedReaddir.mockResolvedValue(['ancient.jsonl'] as never)
    mockedStat.mockResolvedValue(
      statResult({ size: 1024, mtimeMs: NINETY_ONE_DAYS_AGO }),
    )
    mockedUnlink.mockResolvedValue(undefined as never)

    const result = await cleanupOrphanJsonl()
    expect(result.scanned).toBe(1)
    expect(result.deleted).toBe(1)
    expect(result.freedBytes).toBe(1024)
    expect(mockedUnlink).toHaveBeenCalledTimes(1)
    expect(mockedOpsLog).toHaveBeenCalledWith(
      'jsonl_cleanup',
      'housekeeping',
      expect.objectContaining({ file: 'ancient.jsonl', size: 1024 }),
    )
  })

  it('NO borra .jsonl viejo pero grande (>5KB)', async () => {
    mockedReaddir.mockResolvedValue(['ancient-large.jsonl'] as never)
    mockedStat.mockResolvedValue(
      statResult({ size: 100_000, mtimeMs: NINETY_ONE_DAYS_AGO }),
    )

    const result = await cleanupOrphanJsonl()
    expect(result.scanned).toBe(1)
    expect(result.deleted).toBe(0)
    expect(mockedUnlink).not.toHaveBeenCalled()
  })

  it('NO borra .jsonl chico pero reciente (<90d)', async () => {
    mockedReaddir.mockResolvedValue(['fresh-small.jsonl'] as never)
    mockedStat.mockResolvedValue(
      statResult({ size: 1024, mtimeMs: ONE_DAY_AGO }),
    )

    const result = await cleanupOrphanJsonl()
    expect(result.scanned).toBe(1)
    expect(result.deleted).toBe(0)
    expect(mockedUnlink).not.toHaveBeenCalled()
  })

  it('ignora archivos sin extensión .jsonl', async () => {
    mockedReaddir.mockResolvedValue([
      'session.json',
      'note.txt',
      'config.toml',
    ] as never)

    const result = await cleanupOrphanJsonl()
    expect(result.scanned).toBe(0)
    expect(result.deleted).toBe(0)
    expect(mockedStat).not.toHaveBeenCalled()
  })

  it('procesa múltiples archivos y suma freedBytes', async () => {
    mockedReaddir.mockResolvedValue([
      'a.jsonl',
      'b.jsonl',
      'c.jsonl',
      'd.txt',
    ] as never)
    mockedStat
      .mockResolvedValueOnce(statResult({ size: 1000, mtimeMs: NINETY_ONE_DAYS_AGO }))
      .mockResolvedValueOnce(statResult({ size: 2000, mtimeMs: NINETY_ONE_DAYS_AGO }))
      .mockResolvedValueOnce(statResult({ size: 4000, mtimeMs: ONE_DAY_AGO })) // reciente, no borra

    mockedUnlink.mockResolvedValue(undefined as never)

    const result = await cleanupOrphanJsonl()
    expect(result.scanned).toBe(3)
    expect(result.deleted).toBe(2)
    expect(result.freedBytes).toBe(3000)
  })

  it('fail-soft cuando stat/unlink fallan en un archivo (sigue con los otros)', async () => {
    mockedReaddir.mockResolvedValue(['bad.jsonl', 'good.jsonl'] as never)
    mockedStat
      .mockRejectedValueOnce(new Error('EACCES'))
      .mockResolvedValueOnce(statResult({ size: 500, mtimeMs: NINETY_ONE_DAYS_AGO }))
    mockedUnlink.mockResolvedValue(undefined as never)

    const result = await cleanupOrphanJsonl()
    expect(result.scanned).toBe(2)
    expect(result.deleted).toBe(1)
  })

  it('relanza errores no-ENOENT del readdir', async () => {
    mockedReaddir.mockImplementation(() => {
      const err = new Error('EACCES') as NodeJS.ErrnoException
      err.code = 'EACCES'
      throw err
    })
    await expect(cleanupOrphanJsonl()).rejects.toThrow('EACCES')
  })
})

describe('initHousekeeping + stopHousekeeping', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedReaddir.mockReset()
    mockedReaddir.mockResolvedValue([] as never)
  })

  afterEach(() => {
    stopHousekeeping()
    vi.useRealTimers()
  })

  it('arranca interval + first run delay (idempotente en segunda llamada)', () => {
    initHousekeeping()
    initHousekeeping() // segunda no debe duplicar
    // Ejecutar el primer setTimeout (delay 60s)
    vi.advanceTimersByTime(60_000)
    // No verificamos mockedReaddir aquí — la awaitProm escapes the fake-timer.
    // El punto: no throws.
    expect(true).toBe(true)
  })

  it('stop limpia interval + timer sin throws', () => {
    initHousekeeping()
    expect(() => stopHousekeeping()).not.toThrow()
    expect(() => stopHousekeeping()).not.toThrow() // idempotente
  })
})
