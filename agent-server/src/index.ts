/**
 * Bootstrap del daemon AIOS Agent Server.
 *
 * Orden de boot:
 *   1. Banner.
 *   2. validateRequiredEnv()      — FIX 5: aborta si falta cualquier var crítica.
 *   3. acquireLock()              — singleton vía PID file en STORE_DIR.
 *   4. initDatabase()             — SQLite + WAL.
 *   5. installHookGuard()         — escribe ~/.claude/hooks/agent-server-guard.sh.
 *   6. cleanupOldUploads()        — borra `uploads/` con mtime > 24h (PRP-006).
 *   7. prewarm()                  — SDK pre-warm async (non-fatal).
 *   8. startMCServer()            — bind 127.0.0.1:3099.
 *   9. Bot Telegram (PRP-006)     — opcional; fail-soft si TELEGRAM_BOT_TOKEN
 *                                   o ALLOWED_CHAT_ID faltan.
 *  10. initScheduler()            — PRP-007: poller 60s + 2 jobs seedeados.
 *  11. initHousekeeping()         — PRP-010 / FIX 6: cleanup .jsonl huérfanos diario.
 *  12. SIGINT/SIGTERM listeners   — bot.stop() → stopHousekeeping() → stopScheduler() → stopMCServer().
 */

import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { Bot } from 'grammy'

import { validateRequiredEnv, MissingEnvError } from './env.js'
import { STORE_DIR, UPLOADS_DIR, MC_SERVER_PORT, ALLOWED_CHAT_ID } from './config.js'
import { initDatabase } from './db.js'
import { prewarm } from './agent.js'
import { startMCServer, stopMCServer } from './server.js'
import { cleanupOldUploads } from './media.js'
import { createBot, isBotConfigured } from './bot.js'
import { initScheduler, stopScheduler } from './scheduler.js'
import { initHousekeeping, stopHousekeeping } from './housekeeping.js'
import { configureErrorAlerts } from './error-alerts.js'
import { readEnvFile } from './env.js'
import { logger } from './logger.js'

const PID_FILE = join(STORE_DIR, 'agent-server.pid')

// ─── Singleton lock ──────────────────────────────────────────────────────────

function acquireLock(): void {
  mkdirSync(STORE_DIR, { recursive: true })
  if (existsSync(PID_FILE)) {
    const existingPid = readFileSync(PID_FILE, 'utf8').trim()
    try {
      process.kill(parseInt(existingPid, 10), 0)
      logger.error({ pid: existingPid }, 'another instance is already running, exiting')
      process.exit(1)
    } catch {
      logger.warn({ pid: existingPid }, 'stale PID file found, removing')
      unlinkSync(PID_FILE)
    }
  }
  writeFileSync(PID_FILE, String(process.pid))
  logger.debug({ pid: process.pid, pidFile: PID_FILE }, 'lock acquired')
}

function releaseLock(): void {
  try {
    if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
  } catch {
    // ignore
  }
}

// ─── Hook guard install ──────────────────────────────────────────────────────

const HOOK_GUARD_FILENAME = 'agent-server-guard.sh'
const HOOK_GUARD_CONTENT = `#!/usr/bin/env bash
# Installed by AIOS agent-server (PRP-004). Do not edit.
# Skip hook entirely when running inside the daemon subprocess to avoid
# the daemon recursively self-invoking itself via Claude Code hooks.
if [ -n "$AGENT_SERVER_DAEMON" ]; then
  exit 0
fi
`

function installHookGuard(): void {
  const hooksDir = join(homedir(), '.claude', 'hooks')
  const guardPath = join(hooksDir, HOOK_GUARD_FILENAME)

  try {
    mkdirSync(hooksDir, { recursive: true })
  } catch (err) {
    logger.warn({ err, hooksDir }, 'could not create ~/.claude/hooks/ (non-fatal)')
    return
  }

  if (existsSync(guardPath)) {
    try {
      const current = readFileSync(guardPath, 'utf8')
      if (current === HOOK_GUARD_CONTENT) {
        logger.info({ guardPath }, 'hook guard already installed')
      } else {
        logger.warn({ guardPath }, 'hook guard exists with different content; not overwriting. Verify it starts with the AGENT_SERVER_DAEMON guard.')
      }
      return
    } catch {
      // fall through to write
    }
  }

  try {
    writeFileSync(guardPath, HOOK_GUARD_CONTENT, { mode: 0o755 })
    logger.info({ guardPath }, 'hook guard installed')
  } catch (err) {
    logger.warn({ err, guardPath }, 'could not install hook guard (non-fatal)')
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════╗')
  console.log('║         AIOS Agent v1             ║')
  console.log('╚═══════════════════════════════════╝')
  console.log()

  // 1. FIX 5: env validation — primero, antes de cualquier side-effect.
  try {
    const env = validateRequiredEnv()
    logger.info({ requiredCount: Object.keys(env).length }, 'env validated')
  } catch (err) {
    if (err instanceof MissingEnvError) {
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }

  // 2. Singleton lock — antes de bindear puerto o tocar BD.
  acquireLock()

  // 3. Database.
  initDatabase()
  logger.info({ store: STORE_DIR }, 'database initialized')

  // 4. Hook guard pattern.
  installHookGuard()

  // 5. Uploads dir + cleanup (PRP-006). El cleanup tolera dir faltante.
  mkdirSync(UPLOADS_DIR, { recursive: true })
  cleanupOldUploads()

  // 6. SDK pre-warm — fire-and-forget, non-fatal.
  void prewarm()

  // 7. HTTP server.
  startMCServer()

  // 8. Telegram bot (PRP-006) — fail-soft. Si las dos vars faltan, daemon
  // sigue sirviendo el HTTP server normal y registra el motivo en logs.
  let bot: Bot | null = null
  if (isBotConfigured()) {
    try {
      bot = createBot()
      void bot.start({
        onStart: (info) => {
          logger.info({ username: info.username }, 'bot online')
        },
      }).catch((err) => {
        logger.error({ err }, 'bot.start() failed (daemon continues without Telegram)')
        bot = null
      })
    } catch (err) {
      logger.error({ err }, 'createBot() threw (daemon continues without Telegram)')
      bot = null
    }
  } else {
    logger.warn('bot disabled (missing TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID)')
  }

  // Cablear error alerts vía Telegram cuando el bot está vivo. Si bot=null el
  // ops-logger igual tira maybeAlert pero retorna no-op porque getBot() devuelve null.
  // Alerts are a push with no chat to reply to, so they address the primary
  // entry of the allowlist rather than the raw env value, which may be a list.
  configureErrorAlerts({
    botGetter: () => bot,
    chatIdGetter: () => ALLOWED_CHAT_ID,
  })

  // 9. Cron scheduler (PRP-007). Seedea 2 jobs si no existen + arranca poller 60s.
  initScheduler()
  initHousekeeping()

  // 10. Signal handlers.
  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info({ signal }, 'shutting down...')
    if (bot) {
      try {
        await bot.stop()
        logger.info('bot stopped')
      } catch (err) {
        logger.warn({ err }, 'error during bot.stop()')
      }
    }
    try {
      stopHousekeeping()
    } catch (err) {
      logger.warn({ err }, 'error during stopHousekeeping()')
    }
    try {
      stopScheduler()
    } catch (err) {
      logger.warn({ err }, 'error during stopScheduler()')
    }
    try {
      await stopMCServer()
    } catch (err) {
      logger.warn({ err }, 'error during HTTP server close')
    }
    releaseLock()
    logger.info('goodbye')
    process.exit(0)
  }

  process.once('SIGINT', () => { void shutdown('SIGINT') })
  process.once('SIGTERM', () => { void shutdown('SIGTERM') })

  // Touch PID file so launchd / external watchers see it fresh.
  try { statSync(PID_FILE) } catch { /* ignore */ }
}

main().catch((err) => {
  logger.error({ err }, 'fatal error during boot')
  releaseLock()
  process.exit(1)
})
