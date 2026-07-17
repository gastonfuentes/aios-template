/**
 * PRP-034 Sub-fase 2: types compartidos para Scheduled.
 *
 * Espejo del shape SQLite del daemon (`agent-server/src/db.ts` ScheduledTask).
 */

export type ScheduledTask = {
  id: string
  chat_id: string
  thread_id: number | null
  prompt: string
  schedule: string
  next_run: number
  last_run: number | null
  last_result: string | null
  status: 'active' | 'paused'
  created_at: number
}
