/**
 * Cron scheduler — Fase 7 (PRP-007).
 *
 * Poller cada 60s sobre `scheduled_tasks`. Claim race-safe (UPDATE next_run
 * ANTES de invocar el SDK) para evitar reprocesar el mismo job cuando el
 * agente tarda > 60s. Una sesión SDK por categoría por semana ISO via
 * `cron_sessions` (FIX 3 ya en disco).
 *
 * `cron-parser` es CJS — usar `createRequire` para interop confiable desde
 * ESM. Mismo patrón que el template referencia.
 *
 * `SECURITY_PREAMBLE` (verbatim del template) cierra el riesgo (2) del brief:
 * datos externos (BD, web, contenido del operador) son display-only, nunca
 * instrucciones. Markers `<<<DATA>>>...<<<END_DATA>>>` lo refuerzan.
 *
 * `mcCronResult` sigue silent-skip mientras `/api/openclaw/event` no exista
 * en MC (deferido a Fase 10) — comportamiento garantizado por mc-client.ts.
 *
 * `weekly-backup` NO vive aquí: corre fuera del scheduler como bash + launchd
 * propio (`agent-server/scripts/weekly-backup.sh`).
 */

import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { parseExpression } = _require('cron-parser') as any
import {
  getDueTasks,
  createTask,
  updateTaskAfterRun,
  taskExists,
  getDb,
  getCronSession,
  setCronSession,
} from './db.js'
import { runAgent } from './agent.js'
import { logger } from './logger.js'
import { ALLOWED_CHAT_ID, SCHEDULER_TZ } from './config.js'
import { mcCronResult } from './mc-client.js'
import { opsLogger } from './ops-logger.js'

let schedulerInterval: ReturnType<typeof setInterval> | null = null

// Categoría → reuse SDK session por semana ISO.
// Vaciado en cleanup pre-replanteo (2026-05-12): los 3 jobs históricos
// (daily-briefing-6am, nightly-community-pulse, monthly-memory-snapshot)
// fueron eliminados. Cuando se replanteen los nuevos jobs, agregar entries
// aquí + entries paralelas en DEFAULT_TASKS abajo.
export const CRON_CATEGORY: Record<string, string> = {}

export function computeNextRun(cronExpression: string): number {
  const interval = parseExpression(cronExpression, { tz: SCHEDULER_TZ })
  return Math.floor(interval.next().getTime() / 1000)
}

export async function runDueTasks(forcedId?: string): Promise<void> {
  const tasks = forcedId
    ? (() => {
        const row = getDb()
          .prepare('SELECT * FROM scheduled_tasks WHERE id = ? AND status = ?')
          .get(forcedId, 'active') as ReturnType<typeof getDueTasks>[number] | undefined
        return row ? [row] : []
      })()
    : getDueTasks()
  if (tasks.length === 0) return

  for (const task of tasks) {
    // Claim race-safe: avanzar next_run ANTES de ejecutar. Sin esto el poller
    // (60s) recoge el mismo job dos veces si el agente tarda > 60s.
    const nextRun = computeNextRun(task.schedule)
    getDb().prepare('UPDATE scheduled_tasks SET next_run = ? WHERE id = ?').run(nextRun, task.id)

    logger.info({ taskId: task.id, prompt: task.prompt.slice(0, 80) }, 'running scheduled task')
    opsLogger.log('cron_start', 'cron', { jobId: task.id, schedule: task.schedule })

    try {
      const category = CRON_CATEGORY[task.id]
      const existingSessionId = category ? getCronSession(category) : undefined
      const result = await runAgent(task.prompt, existingSessionId, undefined, 'cron')
      if (category && result.newSessionId) {
        setCronSession(category, result.newSessionId)
      }
      const text = result.text?.trim() ?? ''

      // Webhook silent-skip a MC (Fase 10 conectará `/api/openclaw/event`).
      await mcCronResult(task.id, text || '(no output)')

      updateTaskAfterRun(task.id, text || '(no output)', nextRun)
      opsLogger.log('cron_done', 'cron', { jobId: task.id, resultLength: text.length })
      logger.info({ taskId: task.id, nextRun }, 'task completed')
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'scheduled task error')
      opsLogger.log('cron_error', 'cron', { jobId: task.id, error: String(err) })
      await mcCronResult(task.id, '', String(err))
      updateTaskAfterRun(task.id, `Error: ${String(err)}`, nextRun)
    }
  }
}

export function initScheduler(): void {
  seedDefaultTasks()
  schedulerInterval = setInterval(() => {
    runDueTasks().catch((err) => logger.error({ err }, 'scheduler poll error'))
  }, 60_000)
  logger.info({ tz: SCHEDULER_TZ }, 'scheduler started')
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    logger.info('scheduler stopped')
  }
}

// ============================================================
// SEED: cron jobs (vaciado 2026-05-12 para replanteo en nueva sesión)
// ============================================================
//
// Cuando se replanteen jobs nuevos:
//   1. Definir prompt(s) como const local(es) — opcionalmente con un
//      SECURITY_PREAMBLE prepended si procesan datos externos (Supabase rows,
//      contenido del operador, web). Convención canónica: envolver datos
//      externos entre <<<DATA>>>...<<<END_DATA>>>.
//   2. Agregar entries al array DEFAULT_TASKS abajo.
//   3. Agregar el mapping id → categoría al CRON_CATEGORY map arriba.
//   4. Rebuild + restart daemon. seedDefaultTasks() los persiste idempotente
//      al boot (taskExists() guard).
//
// Histórico (eliminado): daily-briefing-6am, nightly-community-pulse,
// monthly-memory-snapshot. Ver PRP-007 / PRP-008 / PRP-027 para contexto
// de la primera generación.

interface SeedTask {
  id: string
  schedule: string
  prompt: string
}

const DEFAULT_TASKS: SeedTask[] = []

function seedDefaultTasks(): void {
  const chatId = ALLOWED_CHAT_ID || 'cron-system'

  for (const task of DEFAULT_TASKS) {
    if (taskExists(task.id)) continue
    const nextRun = computeNextRun(task.schedule)
    createTask({
      id: task.id,
      chat_id: chatId,
      thread_id: null,
      prompt: task.prompt,
      schedule: task.schedule,
      next_run: nextRun,
      status: 'active',
      created_at: Math.floor(Date.now() / 1000),
    })
    logger.info({ taskId: task.id, nextRun, schedule: task.schedule }, 'seeded default cron task')
  }
}
