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
import { createRequire } from 'node:module'
import { readEnvFile } from './env.js'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Ruta absoluta al binario glibc de Claude Code que trae el SDK.
 *
 * El resolver del SDK prueba primero el build musl; en este host glibc ese
 * build no puede ejecutarse y `query()` falla con un "binary not found"
 * engañoso. Fijar el glibc explícitamente es el fix determinista, el mismo que
 * ya usa `gannet-ia-service/src/config.ts`. Se resuelve al import para que una
 * instalación rota falle en el boot y no en el primer mensaje de Telegram.
 */
export const CLAUDE_BINARY_PATH: string = require.resolve(
  '@anthropic-ai/claude-agent-sdk-linux-x64/claude',
)

// Build (`dist/config.js`) y dev (`src/config.ts` via tsx) están ambos a 2
// niveles del repo root. `__dirname/../..` resuelve correctamente en los dos.
const DEFAULT_PROJECT_ROOT = join(__dirname, '..', '..')

/**
 * Raíz de trabajo del agente. El SDK corre con `cwd: PROJECT_ROOT` y
 * `permissionMode: 'bypassPermissions'`, así que este valor define exactamente
 * qué puede tocar el agente desde Telegram.
 *
 * `AGENT_PROJECT_ROOT` permite apuntarlo fuera del repo. Sin la var el
 * comportamiento es el histórico: la raíz del monorepo.
 */
export const PROJECT_ROOT =
  readEnvFile(['AGENT_PROJECT_ROOT'])['AGENT_PROJECT_ROOT']?.trim() || DEFAULT_PROJECT_ROOT

const AGENT_DIR = join(__dirname, '..')
export const STORE_DIR = join(AGENT_DIR, 'store')
export const UPLOADS_DIR = join(STORE_DIR, 'uploads')

// Constantes del dominio del daemon
export const AGENT_TIMEOUT_MS = 600_000 // 10 min hard cap por query
export const MAX_MESSAGE_LENGTH = 4096
export const TYPING_REFRESH_MS = 4000

// HTTP server (read aquí para tener defaults limpios; required vars viven
// en validateRequiredEnv del env.ts).
const httpEnv = readEnvFile(['MC_SERVER_PORT', 'MC_SERVER_HOST', 'LOG_LEVEL', 'SCHEDULER_TZ'])
export const MC_SERVER_PORT = parseInt(httpEnv['MC_SERVER_PORT'] ?? '3099', 10)
// Bind host. Default 127.0.0.1 preserves the local-laptop security posture (no
// LAN exposure). In a container behind Traefik, set MC_SERVER_HOST=0.0.0.0 so the
// reverse proxy on the Docker network can reach the daemon.
export const MC_SERVER_HOST = httpEnv['MC_SERVER_HOST'] ?? '127.0.0.1'
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

/**
 * `ALLOWED_CHAT_ID` accepts a comma-separated list so more than one person can
 * reach the daemon. A single value behaves exactly as before.
 *
 * Order matters: the first entry is the primary chat. Cron seeding and error
 * alerts address that one, because those are pushes with no chat to reply to.
 */
export function parseAllowedChatIds(raw: string): readonly string[] {
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

export const ALLOWED_CHAT_IDS: readonly string[] = parseAllowedChatIds(
  phase6Env['ALLOWED_CHAT_ID'] ?? '',
)

/** Primary chat — target for cron output and error alerts. */
export const ALLOWED_CHAT_ID = ALLOWED_CHAT_IDS[0] ?? ''
export const GROQ_API_KEY = phase6Env['GROQ_API_KEY'] ?? ''
export const ELEVENLABS_API_KEY = phase6Env['ELEVENLABS_API_KEY'] ?? ''
export const ELEVENLABS_VOICE_ID = phase6Env['ELEVENLABS_VOICE_ID'] ?? ''
