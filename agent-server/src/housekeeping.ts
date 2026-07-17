/**
 * Housekeeping diario (PRP-010 — FIX 6 del brief AIOS).
 *
 * Borra archivos `.jsonl` huérfanos de sesiones SDK en
 * `~/.claude/projects/<encoded-cwd>/` que matcheen los 3 criterios:
 *   - extensión `.jsonl`
 *   - `mtime` más de 90 días
 *   - `size` < 5 KB (sesiones nunca usadas o "saludo y cierre")
 *
 * Heurística pragmática: NO consulta Supabase. Las sesiones que importan
 * tienen tamaño > 5KB (varios turnos persistidos) y/o se tocaron en los
 * últimos 90 días. Una `.jsonl` pequeña + vieja + huérfana es ruido seguro.
 *
 * Schedule: `setInterval` 24h, primera corrida al minuto 1 del boot.
 * Cada delete loggea a `ops_events` con `source='housekeeping'`.
 */

import { readdir, stat, unlink } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { logger } from './logger.js'
import { opsLogger } from './ops-logger.js'
import { PROJECT_ROOT } from './config.js'

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
const FIVE_KB = 5 * 1024
const HOUSEKEEPING_INTERVAL_MS = 24 * 60 * 60 * 1000
const FIRST_RUN_DELAY_MS = 60 * 1000

let housekeepingInterval: ReturnType<typeof setInterval> | null = null
let firstRunTimer: ReturnType<typeof setTimeout> | null = null

function projectsDir(): string {
  // El SDK encodea el cwd reemplazando `/` por `-`. PROJECT_ROOT empieza con
  // `<PROJECT_ROOT>` → encoded `<project-slug>`.
  const encoded = PROJECT_ROOT.replace(/\//g, '-')
  return join(homedir(), '.claude', 'projects', encoded)
}

export async function cleanupOrphanJsonl(): Promise<{
  scanned: number
  deleted: number
  freedBytes: number
}> {
  const dir = projectsDir()
  let scanned = 0
  let deleted = 0
  let freedBytes = 0

  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      logger.info({ dir }, 'housekeeping: projects dir not found, skip')
      return { scanned: 0, deleted: 0, freedBytes: 0 }
    }
    throw err
  }

  const now = Date.now()
  for (const name of entries) {
    if (!name.endsWith('.jsonl')) continue
    scanned += 1
    const filePath = join(dir, name)
    try {
      const st = await stat(filePath)
      const ageMs = now - st.mtimeMs
      const tooOld = ageMs > NINETY_DAYS_MS
      const tooSmall = st.size < FIVE_KB
      if (!tooOld || !tooSmall) continue

      await unlink(filePath)
      deleted += 1
      freedBytes += st.size
      opsLogger.log('jsonl_cleanup', 'housekeeping', {
        file: name,
        size: st.size,
        ageDays: Math.floor(ageMs / 86_400_000),
      })
      logger.info(
        { file: name, size: st.size, ageDays: Math.floor(ageMs / 86_400_000) },
        'housekeeping: removed orphan jsonl'
      )
    } catch (err) {
      logger.warn({ err: String(err), file: name }, 'housekeeping: stat/unlink failed')
    }
  }

  return { scanned, deleted, freedBytes }
}

async function runHousekeepingTick(): Promise<void> {
  try {
    const result = await cleanupOrphanJsonl()
    logger.info(result, 'housekeeping tick complete')
    if (result.deleted > 0) {
      opsLogger.log('housekeeping_summary', 'housekeeping', result)
    }
  } catch (err) {
    logger.error({ err: String(err) }, 'housekeeping tick failed')
  }
}

export function initHousekeeping(): void {
  if (housekeepingInterval) return
  firstRunTimer = setTimeout(() => {
    void runHousekeepingTick()
  }, FIRST_RUN_DELAY_MS)
  housekeepingInterval = setInterval(() => {
    void runHousekeepingTick()
  }, HOUSEKEEPING_INTERVAL_MS)
  logger.info(
    { firstRunInSec: FIRST_RUN_DELAY_MS / 1000, intervalH: HOUSEKEEPING_INTERVAL_MS / 3600_000 },
    'housekeeping initialized'
  )
}

export function stopHousekeeping(): void {
  if (firstRunTimer) {
    clearTimeout(firstRunTimer)
    firstRunTimer = null
  }
  if (housekeepingInterval) {
    clearInterval(housekeepingInterval)
    housekeepingInterval = null
    logger.info('housekeeping stopped')
  }
}
