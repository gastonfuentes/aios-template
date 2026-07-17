/**
 * Tests unitarios de `embed.ts` (PRP-026, Fase 3 brief master agent).
 *
 * Cubre:
 *  - happy path: response 200 con embedding 1536d retornado byte-exact.
 *  - retry: 429 → backoff → 200 (con setTimeout mockeado para no esperar real).
 *  - retry exhausted: 429 cuatro veces, throw EmbeddingError con retryable=true.
 *  - truncation: input > 32KB se trunca y la request envía body acotado.
 *  - fail-soft sin OPENAI_API_KEY → EmbeddingNotConfiguredError con status 503.
 *  - cache LRU: dos calls al mismo texto invocan fetch UNA sola vez.
 *  - shape inválido del provider → EmbeddingError.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockReadEnvFile = vi.fn()
vi.mock('./env.js', () => ({
  readEnvFile: (...args: unknown[]) => mockReadEnvFile(...args),
}))

vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Importar después de los mocks.
const embedModule = await import('./embed.js')
const {
  embedText,
  isEmbeddingConfigured,
  clearEmbeddingCache,
  EmbeddingError,
  EmbeddingNotConfiguredError,
  EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL,
} = embedModule

const VALID_VECTOR = new Array(EMBEDDING_DIMENSIONS).fill(0).map((_, i) => i / EMBEDDING_DIMENSIONS)

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

describe('embed.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    clearEmbeddingCache()
    mockReadEnvFile.mockReturnValue({
      OPENAI_API_KEY: 'sk-test-xxxxx',
      OPENAI_EMBEDDING_MODEL: '',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('happy path: retorna embedding 1536d byte-exact', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: VALID_VECTOR, index: 0 }] }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await embedText('hola mundo')

    expect(result).toEqual(VALID_VECTOR)
    expect(result.length).toBe(EMBEDDING_DIMENSIONS)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/embeddings')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer sk-test-xxxxx')
    const body = JSON.parse(init.body)
    expect(body.model).toBe(DEFAULT_EMBEDDING_MODEL)
    expect(body.input).toBe('hola mundo')
    expect(body.dimensions).toBe(EMBEDDING_DIMENSIONS)
  })

  it('retry: 429 una vez → backoff → 200', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'rate limit' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [{ embedding: VALID_VECTOR, index: 0 }] }))
    vi.stubGlobal('fetch', fetchSpy)

    const promise = embedText('retry-test', { skipCache: true })
    await vi.advanceTimersByTimeAsync(1500)
    const result = await promise

    expect(result).toEqual(VALID_VECTOR)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('retry exhausted: 4× 429 → throw EmbeddingError retryable', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(429, { error: { message: 'persistent rate limit' } }))
    vi.stubGlobal('fetch', fetchSpy)

    const promise = embedText('exhaust-test', { skipCache: true }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(10_000)
    const err = await promise

    expect(err).toBeInstanceOf(EmbeddingError)
    expect((err as EmbeddingError).status).toBe(429)
    expect((err as EmbeddingError).retryable).toBe(true)
    // 1 inicial + 3 retries = 4 fetch calls
    expect(fetchSpy).toHaveBeenCalledTimes(4)
  })

  it('truncation: input > 32KB se trunca y el body enviado refleja el cap', async () => {
    const huge = 'x'.repeat(50 * 1024) // 50 KB
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: VALID_VECTOR, index: 0 }] }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await embedText(huge, { skipCache: true })

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.input.length).toBe(32 * 1024)
  })

  it('fail-soft: sin OPENAI_API_KEY → EmbeddingNotConfiguredError con status 503', async () => {
    mockReadEnvFile.mockReturnValue({ OPENAI_API_KEY: '', OPENAI_EMBEDDING_MODEL: '' })
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    expect(isEmbeddingConfigured()).toBe(false)
    await expect(embedText('whatever')).rejects.toBeInstanceOf(EmbeddingNotConfiguredError)
    await expect(embedText('whatever')).rejects.toMatchObject({ status: 503 })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('cache LRU: dos calls al mismo texto invocan fetch UNA sola vez', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: VALID_VECTOR, index: 0 }] }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const a = await embedText('cached-text')
    const b = await embedText('cached-text')

    expect(a).toEqual(VALID_VECTOR)
    expect(b).toEqual(VALID_VECTOR)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('shape inválido (length wrong): throw EmbeddingError', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }] }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await expect(embedText('bad-shape', { skipCache: true })).rejects.toBeInstanceOf(EmbeddingError)
  })

  it('HTTP 4xx no-retryable (e.g. 401): throw inmediato sin retry', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(textResponse(401, 'invalid api key'))
    vi.stubGlobal('fetch', fetchSpy)

    await expect(embedText('unauthorized', { skipCache: true })).rejects.toMatchObject({
      name: 'EmbeddingError',
      status: 401,
      retryable: false,
    })
    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('OPENAI_EMBEDDING_MODEL override se respeta', async () => {
    mockReadEnvFile.mockReturnValue({
      OPENAI_API_KEY: 'sk-test-xxxxx',
      OPENAI_EMBEDDING_MODEL: 'text-embedding-3-large',
    })
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, { data: [{ embedding: VALID_VECTOR, index: 0 }] }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    await embedText('model-override', { skipCache: true })

    const [, init] = fetchSpy.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.model).toBe('text-embedding-3-large')
  })
})
