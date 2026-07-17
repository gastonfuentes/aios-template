/**
 * SQLite local del daemon — `agent-server/store/agent-server.db`.
 *
 * Schema subset Fase 4 (refinamiento #3 del PRP-004): SIN tablas `memories`
 * y `memories_fts`. Si una fase futura las necesita, se agregan con
 * migración aditiva.
 *
 * FIX 3 del brief: `currentWeekKey()` usa `getISOWeek` + `getISOWeekYear`
 * de date-fns en lugar del cálculo naïve del template referencia.
 */

import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { STORE_DIR } from './config.js'

export interface ScheduledTask {
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

let db: Database.Database

export function initDatabase(): void {
  mkdirSync(STORE_DIR, { recursive: true })

  db = new Database(join(STORE_DIR, 'agent-server.db'))
  db.pragma('journal_mode = WAL')

  db.exec(`
    -- Cada chat_id mapea a un Claude Code session_id.
    CREATE TABLE IF NOT EXISTS sessions (
      chat_id   TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Cron jobs (consumidos por el scheduler en Fase 7; tabla creada vacía aquí).
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id          TEXT PRIMARY KEY,
      chat_id     TEXT NOT NULL,
      thread_id   INTEGER,
      prompt      TEXT NOT NULL,
      schedule    TEXT NOT NULL,
      next_run    INTEGER NOT NULL,
      last_run    INTEGER,
      last_result TEXT,
      status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status_next
      ON scheduled_tasks(status, next_run);

    -- Usage tracking por query (cost, tokens, duración).
    CREATE TABLE IF NOT EXISTS query_usage (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key   TEXT NOT NULL,
      cost_usd      REAL NOT NULL DEFAULT 0,
      input_tokens  INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      duration_ms   INTEGER NOT NULL DEFAULT 0,
      num_turns     INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_query_usage_created
      ON query_usage(created_at);

    -- Cron session reuse: una sesión SDK por categoría por semana ISO.
    CREATE TABLE IF NOT EXISTS cron_sessions (
      category   TEXT NOT NULL,
      week_key   TEXT NOT NULL, -- formato 'YYYY-Www' ISO-8601 (FIX 3)
      session_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (category, week_key)
    );
  `)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}

// ============================================================
// SESSIONS
// ============================================================

export function getSession(chatId: string): string | undefined {
  const row = db
    .prepare('SELECT session_id FROM sessions WHERE chat_id = ?')
    .get(chatId) as { session_id: string } | undefined
  return row?.session_id
}

export function setSession(chatId: string, sessionId: string): void {
  db.prepare(`
    INSERT INTO sessions (chat_id, session_id, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(chat_id) DO UPDATE SET
      session_id = excluded.session_id,
      updated_at = excluded.updated_at
  `).run(chatId, sessionId, Date.now())
}

export function clearSession(chatId: string): void {
  db.prepare('DELETE FROM sessions WHERE chat_id = ?').run(chatId)
}

// ============================================================
// SCHEDULED TASKS (consumidas por Fase 7)
// ============================================================

export function getDueTasks(): ScheduledTask[] {
  const now = Math.floor(Date.now() / 1000)
  return db
    .prepare(`
      SELECT * FROM scheduled_tasks
      WHERE status = 'active' AND next_run <= ?
    `)
    .all(now) as ScheduledTask[]
}

export function createTask(task: Omit<ScheduledTask, 'last_run' | 'last_result'>): void {
  db.prepare(`
    INSERT INTO scheduled_tasks
      (id, chat_id, thread_id, prompt, schedule, next_run, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id,
    task.chat_id,
    task.thread_id ?? null,
    task.prompt,
    task.schedule,
    task.next_run,
    task.status,
    task.created_at
  )
}

export function updateTaskAfterRun(id: string, result: string, nextRun: number): void {
  db.prepare(`
    UPDATE scheduled_tasks
    SET last_run = ?, last_result = ?, next_run = ?
    WHERE id = ?
  `).run(Math.floor(Date.now() / 1000), result, nextRun, id)
}

export function updateTaskStatus(id: string, status: 'active' | 'paused'): void {
  db.prepare('UPDATE scheduled_tasks SET status = ? WHERE id = ?').run(status, id)
}

/**
 * PRP-034 Sub-fase 2: PATCH /schedule/:id editor.
 * Solo permite cambiar `prompt`, `schedule` y/o `next_run`. Inmutables: id,
 * chat_id, thread_id, created_at, last_run, last_result. Si el caller no pasa
 * un campo, no se toca (UPDATE selectivo via COALESCE pattern).
 */
export function updateTaskFields(
  id: string,
  fields: { prompt?: string; schedule?: string; next_run?: number }
): void {
  const sets: string[] = []
  const values: (string | number)[] = []
  if (fields.prompt !== undefined) {
    sets.push('prompt = ?')
    values.push(fields.prompt)
  }
  if (fields.schedule !== undefined) {
    sets.push('schedule = ?')
    values.push(fields.schedule)
  }
  if (fields.next_run !== undefined) {
    sets.push('next_run = ?')
    values.push(fields.next_run)
  }
  if (sets.length === 0) return
  values.push(id)
  db.prepare(`UPDATE scheduled_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteTask(id: string): void {
  db.prepare('DELETE FROM scheduled_tasks WHERE id = ?').run(id)
}

export function listTasks(): ScheduledTask[] {
  return db
    .prepare('SELECT * FROM scheduled_tasks ORDER BY created_at DESC')
    .all() as ScheduledTask[]
}

export function getTask(id: string): ScheduledTask | undefined {
  return db
    .prepare('SELECT * FROM scheduled_tasks WHERE id = ?')
    .get(id) as ScheduledTask | undefined
}

export function taskExists(id: string): boolean {
  return db.prepare('SELECT id FROM scheduled_tasks WHERE id = ?').get(id) !== undefined
}

// ============================================================
// CRON SESSIONS (categoría → SDK session_id, rotadas semanalmente ISO-8601)
// ============================================================

/**
 * FIX 3: Weekly key ISO-8601 (`YYYY-Www` con padding).
 * `getISOWeek` retorna 1–53; `getISOWeekYear` puede diferir del año
 * calendario en los bordes (e.g. 31-Dic-2024 cae en semana 1 de 2025).
 */
export function currentWeekKey(date: Date = new Date()): string {
  const week = getISOWeek(date)
  const year = getISOWeekYear(date)
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function getCronSession(category: string): string | undefined {
  const week = currentWeekKey()
  const row = db
    .prepare('SELECT session_id FROM cron_sessions WHERE category = ? AND week_key = ?')
    .get(category, week) as { session_id: string } | undefined
  return row?.session_id
}

export function setCronSession(category: string, sessionId: string): void {
  const week = currentWeekKey()
  db.prepare(`
    INSERT INTO cron_sessions (category, week_key, session_id, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(category, week_key) DO UPDATE SET
      session_id = excluded.session_id
  `).run(category, week, sessionId, Date.now())
}

// ============================================================
// QUERY USAGE
// ============================================================

export interface QueryUsageInput {
  sessionKey: string
  costUsd: number
  inputTokens: number
  outputTokens: number
  durationMs: number
  numTurns: number
}

export function saveQueryUsage(usage: QueryUsageInput): void {
  db.prepare(`
    INSERT INTO query_usage (session_key, cost_usd, input_tokens, output_tokens, duration_ms, num_turns, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    usage.sessionKey,
    usage.costUsd,
    usage.inputTokens,
    usage.outputTokens,
    usage.durationMs,
    usage.numTurns,
    Date.now(),
  )
}

export interface UsageSummary {
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  totalQueries: number
  avgDurationMs: number
}

export function getUsageSummary(sinceMs?: number): UsageSummary {
  const since = sinceMs ?? Date.now() - 86_400_000 * 30
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0) as totalCostUsd,
      COALESCE(SUM(input_tokens), 0) as totalInputTokens,
      COALESCE(SUM(output_tokens), 0) as totalOutputTokens,
      COUNT(*) as totalQueries,
      COALESCE(AVG(duration_ms), 0) as avgDurationMs
    FROM query_usage
    WHERE created_at >= ?
  `).get(since) as UsageSummary
  return row
}
