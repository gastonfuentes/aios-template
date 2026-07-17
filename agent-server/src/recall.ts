/**
 * Helper de recall semántico sobre `public.<prefix>_memories` (PRP-026 + PRP-037 refactor).
 *
 * Flujo canónico:
 *   1. Generar embedding del query con `embedText` (OpenAI text-embedding-3-small 1536d).
 *   2. Invocar RPC Supabase `match_<prefix>_memories(query_embedding, match_limit)` que
 *      ejecuta `ORDER BY embedding <=> $1 LIMIT N` y devuelve filas con similarity.
 *   3. Fire-and-forget: invocar RPC `touch_<prefix>_memory(id)` por cada hit para bumpear
 *      `accessed_count` + `last_accessed_at` (no bloquea la respuesta).
 *
 * El nombre de la tabla + RPCs se parametriza via env `MEMORY_TABLE_PREFIX`
 * (default `agent` en template; deployments productivos lo overridan a su prefix histórico
 * si migran desde un schema preexistente con otro naming).
 *
 * Cliente: @supabase/supabase-js con service_role JWT del daemon (MC_SUPABASE_KEY).
 * Trust boundary: daemon local del operador + bearer; nunca expuesto a frontend público.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { embedText, EmbeddingNotConfiguredError, type EmbedOptions } from './embed.js'
import { readEnvFile } from './env.js'
import { logger } from './logger.js'

/**
 * Lee MEMORY_TABLE_PREFIX del .env. Default `agent` (template neutral).
 * Deployments productivos lo overridan al prefix histórico si migran desde un schema preexistente.
 */
function getMemoryTablePrefix(): string {
  const env = readEnvFile(['MEMORY_TABLE_PREFIX'])
  const raw = env['MEMORY_TABLE_PREFIX']?.trim()
  return raw && raw.length > 0 ? raw : 'agent'
}

function getMemoryTableName(): string {
  return `${getMemoryTablePrefix()}_memories`
}

function getMatchRpcName(): string {
  return `match_${getMemoryTablePrefix()}_memories`
}

function getTouchRpcName(): string {
  return `touch_${getMemoryTablePrefix()}_memory`
}

export interface MemoryRow {
  id: string
  content: string
  tags: string[]
  entity: string | null
  importance: number
  accessed_count: number
  last_accessed_at: string | null
  created_at: string
  source: string
  similarity: number
}

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 20

let cachedClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== null) return cachedClient
  const env = readEnvFile(['MC_SUPABASE_URL', 'MC_SUPABASE_KEY'])
  const url = env['MC_SUPABASE_URL']
  const key = env['MC_SUPABASE_KEY']
  if (!url || !key) {
    logger.warn('recall: MC_SUPABASE_URL / MC_SUPABASE_KEY ausentes; recall no opera')
    return null
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
}

/** Útil para tests: re-leer env en la próxima invocación. */
export function resetRecallClient(): void {
  cachedClient = null
}

export class RecallError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'RecallError'
  }
}

export class RecallNotConfiguredError extends RecallError {
  constructor(missing: 'embeddings' | 'supabase') {
    super(`recall not configured: missing ${missing}`, 503)
    this.name = 'RecallNotConfiguredError'
  }
}

export interface RecallOptions extends EmbedOptions {
  /** Top-K. Default 5. Cap 20. */
  limit?: number
}

/**
 * Retorna top-K memorias semánticamente más cercanas al `query`.
 * - Throws RecallNotConfiguredError si OPENAI_API_KEY o Supabase env ausentes.
 * - Throws RecallError para otros fallos (DB, network, RPC error).
 * - Tabla vacía → array vacío (no es error).
 */
export async function recallMemories(query: string, opts: RecallOptions = {}): Promise<MemoryRow[]> {
  const trimmed = query?.trim() ?? ''
  if (trimmed.length === 0) {
    throw new RecallError('query is empty', 400)
  }

  const limit = Math.max(1, Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT))

  let embedding: number[]
  try {
    embedding = await embedText(trimmed, { skipCache: opts.skipCache })
  } catch (err) {
    if (err instanceof EmbeddingNotConfiguredError) {
      throw new RecallNotConfiguredError('embeddings')
    }
    throw new RecallError('embedding failed', 502, err)
  }

  const client = getSupabaseClient()
  if (client === null) throw new RecallNotConfiguredError('supabase')

  const matchRpc = getMatchRpcName()
  const touchRpc = getTouchRpcName()

  const { data, error } = await client.rpc(matchRpc, {
    query_embedding: embedding,
    match_limit: limit,
  })

  if (error) {
    logger.error({ err: error, rpc: matchRpc }, 'recall: supabase.rpc match failed')
    throw new RecallError(`supabase rpc failed: ${error.message}`, 500, error)
  }

  const rows = (data ?? []) as MemoryRow[]

  // Fire-and-forget touch — no bloquea la respuesta.
  if (rows.length > 0) {
    const ids = rows.map(r => r.id)
    Promise.all(
      ids.map(id =>
        client.rpc(touchRpc, { memory_id: id }).then(({ error: tErr }) => {
          if (tErr) logger.warn({ err: tErr, id, rpc: touchRpc }, 'recall: touch failed')
        }),
      ),
    ).catch(err => logger.warn({ err }, 'recall: touch batch error swallowed'))
  }

  return rows
}

/** Sólo para Sub-fase 4 endpoints — exposed para que el server route reuse the validation. */
export function clampLimit(raw: unknown): number {
  const parsed = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(Math.trunc(parsed), MAX_LIMIT))
}
