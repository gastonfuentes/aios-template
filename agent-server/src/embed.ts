/**
 * Wrapper de embeddings OpenAI para {{AGENT_NAME}} semantic memory (PRP-026, Fase 3 brief master {{AGENT_NAME}}).
 *
 * Provider único en arranque: OpenAI `text-embedding-3-small` con `dimensions: 1536`
 * (refinamiento canónico documentado en PRP-026: Voyage-3-large no soporta 1536 nativo).
 *
 * Diseño:
 *  - Fetch directo a `https://api.openai.com/v1/embeddings` (sin SDK extra; consistente
 *    con el patrón del daemon para Groq STT y ElevenLabs TTS).
 *  - Retry exponencial 3 intentos (1s/2s/4s) sobre 429 y 5xx.
 *  - Cache LRU en memoria con cap 50 entries (key = `model::text`). Útil cuando el
 *    indexer corre dos veces seguidas con texto idéntico (idempotencia).
 *  - Truncación a 32KB de input (heurística ~8K tokens × 4 chars/token; cap real del
 *    modelo es 8192 tokens). Log warn si truncó.
 *  - Fail-soft: si `OPENAI_API_KEY` no está sembrado, throw `EmbeddingNotConfiguredError`
 *    (subclase de `EmbeddingError` con status 503). El daemon arranca igual; los
 *    endpoints `/embed` y `/recall` capturan y traducen a HTTP 503.
 */

import { readEnvFile } from './env.js'
import { logger } from './logger.js'

export const EMBEDDING_DIMENSIONS = 1536
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings'
const MAX_INPUT_BYTES = 32 * 1024
const RETRY_DELAYS_MS = [1000, 2000, 4000] as const
const CACHE_MAX_ENTRIES = 50

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'EmbeddingError'
  }
}

export class EmbeddingNotConfiguredError extends EmbeddingError {
  constructor() {
    super('embeddings provider not configured', 503, false)
    this.name = 'EmbeddingNotConfiguredError'
  }
}

interface OpenAIEmbeddingResponse {
  data?: Array<{ embedding: number[]; index: number }>
  usage?: { prompt_tokens?: number; total_tokens?: number }
  error?: { message?: string; type?: string }
}

// LRU simple: Map preserva insertion order; al hit, delete + re-set para "bumpear" al final.
const cache = new Map<string, number[]>()

function readEmbeddingEnv(): { apiKey: string | null; model: string } {
  const env = readEnvFile(['OPENAI_API_KEY', 'OPENAI_EMBEDDING_MODEL'])
  const apiKey = env['OPENAI_API_KEY']
  const model = env['OPENAI_EMBEDDING_MODEL']
  return {
    apiKey: apiKey && apiKey.length > 0 ? apiKey : null,
    model: model && model.length > 0 ? model : DEFAULT_EMBEDDING_MODEL,
  }
}

export function isEmbeddingConfigured(): boolean {
  return readEmbeddingEnv().apiKey !== null
}

/** Útil para tests + scripts admin. No usar en hot paths. */
export function clearEmbeddingCache(): void {
  cache.clear()
}

export function getEmbeddingCacheSize(): number {
  return cache.size
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function truncateInput(text: string): string {
  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes <= MAX_INPUT_BYTES) return text
  // Truncado a nivel char (no byte) para evitar cortar surrogate pair UTF-8;
  // MAX_INPUT_BYTES / 4 es cota conservadora pero correcta para ASCII + acentos.
  const truncated = text.slice(0, MAX_INPUT_BYTES)
  logger.warn({ originalBytes: bytes, truncatedTo: Buffer.byteLength(truncated, 'utf8') }, 'embed input truncated')
  return truncated
}

async function fetchEmbeddingWithRetry(text: string, apiKey: string, model: string): Promise<number[]> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      })

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '')
        const retryable = res.status === 429 || (res.status >= 500 && res.status < 600)
        if (retryable && attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt]
          logger.warn(
            { status: res.status, body: bodyText.slice(0, 200), attempt, delay },
            'OpenAI embedding retryable status; backing off',
          )
          await sleep(delay)
          continue
        }
        throw new EmbeddingError(
          `OpenAI embedding HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
          res.status,
          retryable,
        )
      }

      const json = (await res.json()) as OpenAIEmbeddingResponse
      const emb = json.data?.[0]?.embedding
      if (!Array.isArray(emb) || emb.length !== EMBEDDING_DIMENSIONS) {
        throw new EmbeddingError(
          `OpenAI embedding shape invalid: length=${emb?.length ?? 'undefined'}`,
          500,
          false,
        )
      }
      return emb
    } catch (err) {
      lastErr = err
      // Errores de la API ya re-lanzados arriba como EmbeddingError. Solo reintentar
      // errores de red transitorios (TypeError de fetch nativo).
      const isNetworkErr = err instanceof TypeError
      if (isNetworkErr && attempt < RETRY_DELAYS_MS.length) {
        const delay = RETRY_DELAYS_MS[attempt]
        logger.warn({ err: String(err), attempt, delay }, 'OpenAI embedding network error; backing off')
        await sleep(delay)
        continue
      }
      throw err
    }
  }
  if (lastErr instanceof Error) throw lastErr
  throw new EmbeddingError('OpenAI embedding exhausted retries without specific error', undefined, true)
}

export interface EmbedOptions {
  /** Si true, no consulta ni puebla la cache LRU. Default false. */
  skipCache?: boolean
}

/**
 * Genera embedding 1536d para `text` usando OpenAI text-embedding-3-small.
 * Throws EmbeddingNotConfiguredError si OPENAI_API_KEY no está sembrado.
 */
export async function embedText(text: string, opts: EmbedOptions = {}): Promise<number[]> {
  const { apiKey, model } = readEmbeddingEnv()
  if (apiKey === null) throw new EmbeddingNotConfiguredError()

  const input = truncateInput(text)
  const cacheKey = `${model}::${input}`

  if (!opts.skipCache) {
    const hit = cache.get(cacheKey)
    if (hit !== undefined) {
      // LRU bump: re-insert moves to "newest".
      cache.delete(cacheKey)
      cache.set(cacheKey, hit)
      return hit
    }
  }

  const emb = await fetchEmbeddingWithRetry(input, apiKey, model)

  if (!opts.skipCache) {
    cache.set(cacheKey, emb)
    while (cache.size > CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }
  return emb
}
