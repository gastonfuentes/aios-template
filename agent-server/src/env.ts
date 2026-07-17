/**
 * Lector aislado de `agent-server/.env`.
 *
 * Diseño deliberado: NUNCA escribir a `process.env` desde aquí. El subprocess
 * Claude Agent SDK hereda `process.env` y no debe ver secrets que no necesite.
 * Cada caller pide explícitamente las keys que le interesan vía `readEnvFile(['KEY1', 'KEY2'])`.
 *
 * FIX 5 del brief: `validateRequiredEnv()` aborta el proceso al boot si falta
 * cualquiera de las vars críticas para el daemon (MC_SUPABASE_*, OPENCLAW_*, MISSION_CONTROL_*).
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const AGENT_DIR = join(__dirname, '..')

export function readEnvFile(keys?: string[]): Record<string, string> {
  try {
    const content = readFileSync(join(AGENT_DIR, '.env'), 'utf-8')
    const result: Record<string, string> = {}

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue

      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (keys === undefined || keys.includes(key)) {
        result[key] = value
      }
    }

    return result
  } catch {
    return {}
  }
}

/**
 * Bucket de variables requeridas al boot del daemon (FIX 5).
 * Telegram, voice, GOG quedan diferidas a fases siguientes y se validan
 * cuando esos módulos arranquen, no en el boot de Fase 4.
 */
export const DAEMON_REQUIRED_ENV = [
  'MC_SUPABASE_URL',
  'MC_SUPABASE_KEY',
  'OPENCLAW_GATEWAY_TOKEN',
  'MISSION_CONTROL_ORIGIN',
  'MISSION_CONTROL_URL',
  'MISSION_CONTROL_TOKEN',
] as const

export type DaemonRequiredKey = typeof DAEMON_REQUIRED_ENV[number]

export class MissingEnvError extends Error {
  constructor(public readonly key: string) {
    super(`FATAL: missing required env var: ${key} (agent-server/.env). Aborting before bind.`)
    this.name = 'MissingEnvError'
  }
}

/**
 * Carga y valida las variables requeridas para arrancar el daemon.
 * Throw temprano (antes de bindear el puerto, abrir SQLite, o cargar SDK)
 * con mensaje accionable que identifica la variable faltante.
 */
export function validateRequiredEnv(): Record<DaemonRequiredKey, string> {
  const env = readEnvFile([...DAEMON_REQUIRED_ENV])
  const result = {} as Record<DaemonRequiredKey, string>
  for (const key of DAEMON_REQUIRED_ENV) {
    const value = env[key]
    if (!value || value.length === 0) {
      throw new MissingEnvError(key)
    }
    result[key] = value
  }
  return result
}
