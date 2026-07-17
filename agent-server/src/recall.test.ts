/**
 * Tests unitarios de `recall.ts` (PRP-026, Fase 3 brief master agent).
 *
 * Cubre:
 *  - happy path: query → embedText → rpc match_agent_memories → top-K returned + touch fire-and-forget.
 *  - tabla vacía: rpc retorna [] → fn retorna [].
 *  - error de embedding (EmbeddingNotConfiguredError) → RecallNotConfiguredError('embeddings').
 *  - error de Supabase env (no URL/key) → RecallNotConfiguredError('supabase').
 *  - error de rpc (Supabase error) → RecallError 500.
 *  - clampLimit: defaults + bounds.
 *  - query vacío → RecallError 400.
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

const mockEmbedText = vi.fn()
class FakeEmbeddingNotConfiguredError extends Error {
  status = 503
  retryable = false
  constructor() {
    super('embeddings provider not configured')
    this.name = 'EmbeddingNotConfiguredError'
  }
}

vi.mock('./embed.js', async () => {
  const actual = await vi.importActual<typeof import('./embed.js')>('./embed.js')
  return {
    ...actual,
    embedText: (...args: unknown[]) => mockEmbedText(...args),
    EmbeddingNotConfiguredError: FakeEmbeddingNotConfiguredError,
  }
})

const mockRpc = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  })),
}))

// Import después de los mocks.
const recallModule = await import('./recall.js')
const { recallMemories, resetRecallClient, RecallError, RecallNotConfiguredError, clampLimit } = recallModule

const SAMPLE_ROWS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    content: 'El operador toma café Lavazza',
    tags: ['preference', 'coffee'],
    entity: 'operator',
    importance: 1.0,
    accessed_count: 0,
    last_accessed_at: null,
    created_at: '2026-05-12T00:00:00Z',
    source: 'operator-coffee-lavazza',
    similarity: 0.95,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    content: 'El gato del operador se llama Pelusa',
    tags: ['pet'],
    entity: 'operator',
    importance: 1.0,
    accessed_count: 5,
    last_accessed_at: '2026-05-11T12:00:00Z',
    created_at: '2026-05-10T00:00:00Z',
    source: 'operator-pet-pelusa',
    similarity: 0.40,
  },
]

const VALID_VECTOR = new Array(1536).fill(0.01)

describe('recall.ts', () => {
  beforeEach(() => {
    mockReadEnvFile.mockReturnValue({
      MC_SUPABASE_URL: 'https://test.supabase.co',
      MC_SUPABASE_KEY: 'service-role-test-key',
      MEMORY_TABLE_PREFIX: 'agent', // PRP-037: preserva backward-compat con asserts de RPCs literales.
    })
    mockEmbedText.mockResolvedValue(VALID_VECTOR)
    mockRpc.mockReset()
    resetRecallClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('happy path: retorna top-K + dispara touch fire-and-forget', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: SAMPLE_ROWS, error: null }) // match_agent_memories
      .mockResolvedValue({ data: null, error: null }) // touch_agent_memory (varios calls)

    const rows = await recallMemories('café Lavazza', { limit: 5 })

    expect(rows).toEqual(SAMPLE_ROWS)
    expect(rows[0].similarity).toBeGreaterThan(rows[1].similarity)
    expect(mockEmbedText).toHaveBeenCalledWith('café Lavazza', { skipCache: undefined })
    expect(mockRpc).toHaveBeenCalledWith('match_agent_memories', {
      query_embedding: VALID_VECTOR,
      match_limit: 5,
    })

    // Dejar que las microtareas fire-and-forget se resuelvan.
    await new Promise(r => setTimeout(r, 0))
    const touchCalls = mockRpc.mock.calls.filter(c => c[0] === 'touch_agent_memory')
    expect(touchCalls.length).toBe(SAMPLE_ROWS.length)
  })

  it('tabla vacía: rpc retorna [] → fn retorna []', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    const rows = await recallMemories('algo random')
    expect(rows).toEqual([])
  })

  it('embeddings no configurados → RecallNotConfiguredError("embeddings")', async () => {
    mockEmbedText.mockRejectedValueOnce(new FakeEmbeddingNotConfiguredError())
    const err = await recallMemories('test').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RecallNotConfiguredError)
    expect((err as RecallNotConfiguredError).message).toContain('embeddings')
    expect((err as RecallNotConfiguredError).status).toBe(503)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('Supabase env ausente → RecallNotConfiguredError("supabase")', async () => {
    mockReadEnvFile.mockReturnValue({ MC_SUPABASE_URL: '', MC_SUPABASE_KEY: '' })
    resetRecallClient()
    const err = await recallMemories('test').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RecallNotConfiguredError)
    expect((err as RecallNotConfiguredError).message).toContain('supabase')
  })

  it('rpc error → RecallError 500', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc broken' } })
    const err = await recallMemories('test').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RecallError)
    expect((err as RecallError).status).toBe(500)
  })

  it('query vacío → RecallError 400', async () => {
    const err = await recallMemories('   ').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RecallError)
    expect((err as RecallError).status).toBe(400)
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('embed network error genérico → RecallError 502', async () => {
    mockEmbedText.mockRejectedValueOnce(new Error('network down'))
    const err = await recallMemories('test').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RecallError)
    expect((err as RecallError).status).toBe(502)
  })

  it('clampLimit: bounds correctos', () => {
    expect(clampLimit(undefined)).toBe(5)
    expect(clampLimit(null)).toBe(5)
    expect(clampLimit('not-a-number')).toBe(5)
    expect(clampLimit('3')).toBe(3)
    expect(clampLimit(10)).toBe(10)
    expect(clampLimit(0)).toBe(1)
    expect(clampLimit(-5)).toBe(1)
    expect(clampLimit(100)).toBe(20)
    expect(clampLimit(20)).toBe(20)
    expect(clampLimit(21)).toBe(20)
  })
})
