/**
 * Constantes y rutas derivadas del filesystem.
 *
 * `PROJECT_ROOT` apunta al root del repo monorepo (= `<PROJECT_ROOT>`),
 * NO a `agent-server/`. Esto es load-bearing: el SDK invocation usa
 * `cwd: PROJECT_ROOT` para que las sesiones queden encoded a
 * `~/.claude/projects/<project-slug>/`, compartidas con Claude Code CLI.
 *
 * PRP-006 (Fase 6) suma `UPLOADS_DIR` + las vars de Telegram + voz como
 * exports opcionales (string vacío si no están en .env). El daemon no aborta
 * por estas — bot/voice se gatean fail-soft cuando faltan.
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readEnvFile } from './env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Build (`dist/config.js`) y dev (`src/config.ts` via tsx) están ambos a 2
// niveles del repo root. `__dirname/../..` resuelve correctamente en los dos.
export const PROJECT_ROOT = join(__dirname, '..', '..')

const AGENT_DIR = join(__dirname, '..')
export const STORE_DIR = join(AGENT_DIR, 'store')
export const UPLOADS_DIR = join(STORE_DIR, 'uploads')

// Constantes del dominio del daemon
export const AGENT_TIMEOUT_MS = 600_000 // 10 min hard cap por query
export const MAX_MESSAGE_LENGTH = 4096
export const TYPING_REFRESH_MS = 4000

// HTTP server (read aquí para tener defaults limpios; required vars viven
// en validateRequiredEnv del env.ts).
const httpEnv = readEnvFile(['MC_SERVER_PORT', 'LOG_LEVEL', 'SCHEDULER_TZ'])
export const MC_SERVER_PORT = parseInt(httpEnv['MC_SERVER_PORT'] ?? '3099', 10)
export const LOG_LEVEL = httpEnv['LOG_LEVEL'] ?? 'info'
// Brief manda Guadalajara como default explícito (NO 'UTC' como el template).
export const SCHEDULER_TZ = httpEnv['SCHEDULER_TZ'] ?? 'America/Mexico_City'

// Telegram + voz (PRP-006). String vacío cuando falta en .env — los gates
// fail-soft viven en bot.ts (`isBotConfigured`) y voice.ts (`voiceCapabilities`).
const phase6Env = readEnvFile([
  'TELEGRAM_BOT_TOKEN',
  'ALLOWED_CHAT_ID',
  'GROQ_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
])
export const TELEGRAM_BOT_TOKEN = phase6Env['TELEGRAM_BOT_TOKEN'] ?? ''
export const ALLOWED_CHAT_ID = phase6Env['ALLOWED_CHAT_ID'] ?? ''
export const GROQ_API_KEY = phase6Env['GROQ_API_KEY'] ?? ''
export const ELEVENLABS_API_KEY = phase6Env['ELEVENLABS_API_KEY'] ?? ''
export const ELEVENLABS_VOICE_ID = phase6Env['ELEVENLABS_VOICE_ID'] ?? ''
