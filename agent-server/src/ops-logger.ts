/**
 * Ops Logger — bus central de eventos para observabilidad en tiempo real.
 *
 * Recoge tool calls, eventos de sesión, errores y eventos de sistema del
 * Agent SDK. Cada evento se:
 *   1. Emite vía EventEmitter para consumidores SSE locales (`/ops/stream`).
 *   2. Persiste a Supabase (`public.ops_events`) para acceso desde Mission Control.
 *
 * Shape de columnas validado contra Supabase real (PRP-002 §Modelo de datos):
 *   event_id (text), type (text), source (text), session_id (text|null), data (jsonb).
 */

import { EventEmitter } from 'events'
import { readEnvFile } from './env.js'

// ─── Event types ────────────────────────────────────────────────────────────

export type OpsEventType =
  | 'session_start'
  | 'session_compact'
  | 'tool_start'
  | 'tool_done'
  | 'tool_error'
  | 'agent_text'
  | 'agent_result'
  | 'agent_error'
  | 'cron_start'
  | 'cron_done'
  | 'cron_error'
  | 'stderr'
  | 'rate_limit'
  | 'jsonl_cleanup'
  | 'housekeeping_summary'
  | 'consolidation_start'
  | 'consolidation_done'
  | 'consolidation_error'

// Fuente única de verdad del union de superficies. agent.ts lo importa.
// `'telegram'` agregado por PRP-006 (Fase 6 del brief master AIOS).
// `'housekeeping'` agregado por PRP-010 (Fase 10 — cleanup .jsonl).
export type OpsSource = 'web' | 'cron' | 'system' | 'telegram' | 'housekeeping'

export interface OpsEvent {
  id: string
  type: OpsEventType
  timestamp: number
  source: OpsSource
  sessionId?: string
  data: Record<string, unknown>
}

// ─── Supabase config ─────────────────────────────────────────────────────────

const env = readEnvFile(['MC_SUPABASE_URL', 'MC_SUPABASE_KEY'])
const SUPABASE_URL = env['MC_SUPABASE_URL'] ?? ''
const SUPABASE_KEY = env['MC_SUPABASE_KEY'] ?? ''

function persistToSupabase(event: OpsEvent): void {
  if (!SUPABASE_URL || !SUPABASE_KEY) return

  fetch(`${SUPABASE_URL}/rest/v1/ops_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      event_id: event.id,
      type: event.type,
      source: event.source,
      session_id: event.sessionId ?? null,
      data: event.data,
    }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Silent — el bus nunca se rompe por una falla de persistencia.
  })
}

// ─── Ring buffer ────────────────────────────────────────────────────────────

const MAX_BUFFER = 200

class OpsLogger extends EventEmitter {
  private buffer: OpsEvent[] = []
  private counter = 0

  override emit(event: 'ops', payload: OpsEvent): boolean
  override emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args)
  }

  log(
    type: OpsEventType,
    source: OpsSource,
    data: Record<string, unknown>,
    sessionId?: string,
  ): void {
    const event: OpsEvent = {
      id: `ops-${++this.counter}`,
      type,
      timestamp: Date.now(),
      source,
      data,
      ...(sessionId !== undefined ? { sessionId } : {}),
    }

    this.buffer.push(event)
    if (this.buffer.length > MAX_BUFFER) {
      this.buffer = this.buffer.slice(-MAX_BUFFER)
    }

    this.emit('ops', event)
    persistToSupabase(event)

    // Telegram alert para events con sufijo _error o rate_limit (PRP-010 Tier B
    // mejora). Fail-soft + throttle por tipo. No bloquea el log.
    void import('./error-alerts.js')
      .then((m) => m.maybeAlert(event))
      .catch(() => {})
  }

  /** Eventos recientes, más nuevos primero. */
  getRecent(limit = 50): OpsEvent[] {
    return this.buffer.slice(-limit).reverse()
  }

  get size(): number {
    return this.buffer.length
  }
}

export const opsLogger = new OpsLogger()
opsLogger.setMaxListeners(50) // Soporte para múltiples clientes SSE simultáneos
