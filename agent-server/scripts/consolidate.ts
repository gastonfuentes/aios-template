#!/usr/bin/env tsx
/**
 * Entrypoint del cron `nightly-memory-consolidation` (PRP-027, Fase 4 brief master {{AGENT_NAME}}).
 *
 * Invocado por launchd `com.aios.nightly-memory-consolidation.plist` cada noche
 * a las 3:00am Guadalajara. También invocable manualmente:
 *
 *   npm run consolidate                               # ventana = ayer
 *   tsx scripts/consolidate.ts                        # idem
 *   tsx scripts/consolidate.ts --days-back 2          # consolidar antier
 *   tsx scripts/consolidate.ts --date 2026-05-11      # consolidar fecha específica
 *
 * Fail-soft (PRP-026 canónico):
 *   - `OPENAI_API_KEY` / `MC_SUPABASE_*` ausentes  → WARN + exit 0.
 *   - Extractor LLM falla con JSON malformado     → WARN + persiste 0 facts + lifecycle SÍ corre.
 *   - Error técnico no esperado                   → ERROR full + ops_event + exit 1 (launchd lo registra).
 *
 * Idempotencia (PRP-026 UNIQUE source+content_hash): correr múltiples veces el
 * mismo día NO duplica filas ni gasta embeddings extra.
 */

import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { logger } from '../src/logger.js'
import { readEnvFile } from '../src/env.js'
import { EmbeddingNotConfiguredError } from '../src/embed.js'
import {
  loadConsolidationConfig,
  runConsolidation,
  logConsolidationStart,
  logConsolidationDone,
  logConsolidationError,
  computeDayWindow,
} from '../src/consolidate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SCRIPT_DIR = resolve(__dirname)

interface CliArgs {
  daysBack: number
  explicitDate: string | null
}

function parseArgs(argv: string[]): CliArgs {
  let daysBack = 1
  let explicitDate: string | null = null
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--days-back' || arg === '-d') {
      const next = argv[i + 1]
      if (!next) {
        console.error('FATAL: --days-back requires a number')
        process.exit(1)
      }
      const n = parseInt(next, 10)
      if (!Number.isFinite(n) || n < 0) {
        console.error(`FATAL: invalid --days-back value: ${next}`)
        process.exit(1)
      }
      daysBack = n
      i += 1
    } else if (arg === '--date') {
      const next = argv[i + 1]
      if (!next || !/^\d{4}-\d{2}-\d{2}$/.test(next)) {
        console.error('FATAL: --date requires YYYY-MM-DD')
        process.exit(1)
      }
      explicitDate = next
      i += 1
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: tsx scripts/consolidate.ts [options]
  --days-back N    Consolidar el día = now - N días en TZ Guadalajara (default 1).
  --date YYYY-MM-DD  Consolidar fecha específica (override de --days-back).
  --help           Mostrar esta ayuda.
`)
      process.exit(0)
    }
  }
  return { daysBack, explicitDate }
}

async function main(): Promise<void> {
  void SCRIPT_DIR // silenciar TS unused

  // Pre-check fail-soft: env vars críticas.
  const env = readEnvFile(['MC_SUPABASE_URL', 'MC_SUPABASE_KEY', 'OPENAI_API_KEY'])
  if (!env['MC_SUPABASE_URL'] || !env['MC_SUPABASE_KEY']) {
    logger.warn(
      'consolidate: MC_SUPABASE_URL / MC_SUPABASE_KEY ausentes en agent-server/.env — siembra ambos y reinicia launchd. Job termina sin escribir nada.',
    )
    process.exit(0)
  }
  if (!env['OPENAI_API_KEY']) {
    logger.warn(
      'consolidate: OPENAI_API_KEY ausente en agent-server/.env — embeddings no se pueden generar. Siembra la key y reinicia launchd. Job termina sin escribir nada.',
    )
    process.exit(0)
  }

  const args = parseArgs(process.argv)
  const config = loadConsolidationConfig()

  // Determinar la fecha objetivo
  let nowOverride: Date | undefined
  let daysBackEffective = args.daysBack
  if (args.explicitDate) {
    // Construir "now" = explicitDate + 12:00 GDL para que computeDayWindow(daysBack=0) caiga en esa fecha.
    nowOverride = new Date(`${args.explicitDate}T12:00:00-06:00`)
    daysBackEffective = 0
  }

  const probeWindow = computeDayWindow(nowOverride ?? new Date(), daysBackEffective)
  logConsolidationStart(probeWindow.isoDate, config)

  try {
    const result = await runConsolidation({
      now: nowOverride,
      daysBack: daysBackEffective,
      config,
    })

    logConsolidationDone(result)

    console.log(
      JSON.stringify(
        {
          status: 'ok',
          isoDate: result.isoDate,
          turnsRead: result.turnsRead,
          factsExtracted: result.factsExtracted,
          persistResult: result.persistResult,
          memoryFile: result.memoryFile,
          lifecycle: result.lifecycle,
          durationMs: result.durationMs,
        },
        null,
        2,
      ),
    )

    process.exit(0)
  } catch (err) {
    if (err instanceof EmbeddingNotConfiguredError) {
      logger.warn(
        'consolidate: OPENAI_API_KEY presente pero embeddings provider devolvió EmbeddingNotConfiguredError — verifica formato de la key.',
      )
      logConsolidationError(probeWindow.isoDate, err)
      process.exit(0)
    }
    logger.error({ err }, 'consolidate: fatal error')
    logConsolidationError(probeWindow.isoDate, err)
    process.exit(1)
  }
}

main().catch(err => {
  logger.error({ err }, 'consolidate: top-level error')
  console.error(err)
  process.exit(1)
})
