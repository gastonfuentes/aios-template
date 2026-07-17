/**
 * Tests unitarios de `consolidate.ts` (PRP-027, Fase 4 brief master agent).
 *
 * Cubre:
 *  - parseExtractorJson: happy path + markdown fences + JSON con texto basura + malformado.
 *  - computeDayWindow: TZ Guadalajara, daysBack default + override.
 *  - fetchDailyChatContext: filtra timestamp window + ignora sidechains + concat text.
 *  - buildExtractorPrompt: contiene SECURITY_PREAMBLE + markers + isoDate.
 *  - extractFactsWithLLM: mock SDK query → parse facts.
 *  - persistFacts: idempotente (skip por hash), inserta, race-condition 23505 → skip.
 *  - writeMemoryToolFile: escribe + merge defensivo.
 *  - applyLifecycle: invoca 2 RPCs.
 *  - loadConsolidationConfig: defaults + overrides.
 *
 * Aprendizaje PRP-026 aplicado: clases custom (FakeEmbeddingNotConfiguredError)
 * van en `vi.hoisted()` para evitar ReferenceError de hoist de `vi.mock`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// ─── Mocks hoisted (clases custom + fn shared) ───────────────────────────

const hoisted = vi.hoisted(() => {
  class FakeEmbeddingNotConfiguredError extends Error {
    status = 503
    retryable = false
    constructor() {
      super('embeddings provider not configured')
      this.name = 'EmbeddingNotConfiguredError'
    }
  }
  return {
    mockReadEnvFile: vi.fn(),
    mockEmbedText: vi.fn(),
    mockQuery: vi.fn(),
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
    mockOpsLog: vi.fn(),
    FakeEmbeddingNotConfiguredError,
  }
})

vi.mock('./env.js', () => ({
  readEnvFile: (...args: unknown[]) => hoisted.mockReadEnvFile(...args),
}))

vi.mock('./logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('./embed.js', () => ({
  embedText: (...args: unknown[]) => hoisted.mockEmbedText(...args),
  EmbeddingNotConfiguredError: hoisted.FakeEmbeddingNotConfiguredError,
}))

vi.mock('./ops-logger.js', () => ({
  opsLogger: {
    log: (...args: unknown[]) => hoisted.mockOpsLog(...args),
  },
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: (...args: unknown[]) => hoisted.mockQuery(...args),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (...args: unknown[]) => hoisted.mockFrom(...args),
    rpc: (...args: unknown[]) => hoisted.mockRpc(...args),
  })),
}))

// Import después de los mocks.
const mod = await import('./consolidate.js')
const {
  parseExtractorJson,
  buildExtractorPrompt,
  computeDayWindow,
  fetchDailyChatContext,
  extractFactsWithLLM,
  persistFacts,
  writeMemoryToolFile,
  applyLifecycle,
  loadConsolidationConfig,
  resetConsolidateClient,
  CONSOLIDATION_DEFAULTS,
} = mod

beforeEach(() => {
  hoisted.mockReadEnvFile.mockReset()
  // PRP-037: default backward-compat — preserva asserts de RPCs literales `decay_marley_*` etc.
  // Tests que necesitan override usan `.mockReturnValue(...)` en su scope local (sobrescribe este default).
  hoisted.mockReadEnvFile.mockReturnValue({ MEMORY_TABLE_PREFIX: 'agent' })
  hoisted.mockEmbedText.mockReset()
  hoisted.mockQuery.mockReset()
  hoisted.mockRpc.mockReset()
  hoisted.mockFrom.mockReset()
  hoisted.mockOpsLog.mockReset()
  resetConsolidateClient()
})

// ─── parseExtractorJson ───────────────────────────────────────────────────

describe('parseExtractorJson', () => {
  it('parses well-formed JSON with multiple facts', () => {
    const raw = `{"facts":[{"content":"Juan vive en Guadalajara","entity":"juan-lara","tags":["operator","location"],"importance":1.0},{"content":"El gato se llama Pelusa","entity":"pelusa","tags":["pet"]}]}`
    const facts = parseExtractorJson(raw)
    expect(facts).toHaveLength(2)
    expect(facts[0]?.content).toBe('Juan vive en Guadalajara')
    expect(facts[0]?.entity).toBe('juan-lara')
    expect(facts[0]?.tags).toEqual(['operator', 'location'])
    expect(facts[0]?.importance).toBe(1.0)
    expect(facts[1]?.entity).toBe('pelusa')
    expect(facts[1]?.importance).toBe(1.0) // default
  })

  it('strips markdown fences with ```json', () => {
    const raw = '```json\n{"facts":[{"content":"hola"}]}\n```'
    const facts = parseExtractorJson(raw)
    expect(facts).toHaveLength(1)
    expect(facts[0]?.content).toBe('hola')
  })

  it('strips markdown fences with plain ```', () => {
    const raw = '```\n{"facts":[{"content":"hola"}]}\n```'
    const facts = parseExtractorJson(raw)
    expect(facts).toHaveLength(1)
  })

  it('handles text before/after the JSON', () => {
    const raw = 'Aquí está el JSON:\n{"facts":[{"content":"hola"}]}\nEspero te sirva.'
    const facts = parseExtractorJson(raw)
    expect(facts).toHaveLength(1)
    expect(facts[0]?.content).toBe('hola')
  })

  it('drops facts with empty content', () => {
    const raw = '{"facts":[{"content":""},{"content":"  "},{"content":"válido"}]}'
    const facts = parseExtractorJson(raw)
    expect(facts).toHaveLength(1)
    expect(facts[0]?.content).toBe('válido')
  })

  it('throws ExtractorError on malformed JSON', () => {
    expect(() => parseExtractorJson('this is not json')).toThrow(/failed to parse/)
  })

  it('throws ExtractorError when facts is not an array', () => {
    expect(() => parseExtractorJson('{"facts": "nope"}')).toThrow(/not an array/)
  })

  it('returns empty array when facts is empty', () => {
    expect(parseExtractorJson('{"facts": []}')).toEqual([])
  })

  it('clamps importance < 0 to default 1.0', () => {
    const facts = parseExtractorJson('{"facts":[{"content":"x","importance":-5}]}')
    // -5 invalida → fallback 1.0
    expect(facts[0]?.importance).toBe(1.0)
  })

  it('caps tags to 8 entries', () => {
    const manyTags = Array.from({ length: 20 }, (_, i) => `t${i}`)
    const facts = parseExtractorJson(`{"facts":[{"content":"x","tags":${JSON.stringify(manyTags)}}]}`)
    expect(facts[0]?.tags).toHaveLength(8)
  })
})

// ─── buildExtractorPrompt ─────────────────────────────────────────────────

describe('buildExtractorPrompt', () => {
  it('includes SECURITY_PREAMBLE and DATA markers and iso date', () => {
    const turns = [
      { role: 'user' as const, text: 'hola', timestamp: '2026-05-11T10:00:00Z', sessionId: 's1' },
      { role: 'assistant' as const, text: 'qué tal', timestamp: '2026-05-11T10:00:01Z', sessionId: 's1' },
    ]
    const prompt = buildExtractorPrompt(turns, '2026-05-11')
    expect(prompt).toContain('PROMPT INJECTION')
    expect(prompt).toContain('<<<DATA>>>')
    expect(prompt).toContain('<<<END_DATA>>>')
    expect(prompt).toContain('2026-05-11')
    expect(prompt).toContain('[USER] hola')
    expect(prompt).toContain('[ASSISTANT] qué tal')
  })

  it('truncates context past MAX_CONTEXT_CHARS', () => {
    const longText = 'x'.repeat(50_000)
    const turns = [{ role: 'user' as const, text: longText, timestamp: '2026-05-11T10:00:00Z', sessionId: 's1' }]
    const prompt = buildExtractorPrompt(turns, '2026-05-11')
    expect(prompt).toContain('truncado')
  })
})

// ─── computeDayWindow ─────────────────────────────────────────────────────

describe('computeDayWindow', () => {
  it('rolls back 1 day in Guadalajara TZ by default', () => {
    // target = 2026-05-12T05:00:00-06:00 (5am GDL) → ayer = 2026-05-11
    const target = new Date('2026-05-12T05:00:00-06:00')
    const w = computeDayWindow(target)
    expect(w.isoDate).toBe('2026-05-11')
    expect(w.startUtc.toISOString()).toBe('2026-05-11T06:00:00.000Z') // 00:00 GDL = 06:00 UTC
    expect(w.endUtc.toISOString()).toBe('2026-05-12T06:00:00.000Z')
  })

  it('honors daysBack=0 to consolidate today', () => {
    const target = new Date('2026-05-12T05:00:00-06:00')
    const w = computeDayWindow(target, 0)
    expect(w.isoDate).toBe('2026-05-12')
  })

  it('honors daysBack=2', () => {
    const target = new Date('2026-05-12T05:00:00-06:00')
    const w = computeDayWindow(target, 2)
    expect(w.isoDate).toBe('2026-05-10')
  })

  it('handles late-night target before midnight rollover', () => {
    // 2026-05-12T03:00:00-06:00 (3am GDL del 12) - 1d = 11
    const target = new Date('2026-05-12T03:00:00-06:00')
    const w = computeDayWindow(target)
    expect(w.isoDate).toBe('2026-05-11')
  })
})

// ─── fetchDailyChatContext ────────────────────────────────────────────────

describe('fetchDailyChatContext', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'aios-consolidate-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns empty for non-existent dir', () => {
    const result = fetchDailyChatContext(
      { startUtc: new Date('2026-05-11T06:00:00Z'), endUtc: new Date('2026-05-12T06:00:00Z'), isoDate: '2026-05-11', tz: 'America/Mexico_City' },
      join(tmpDir, 'nonexistent'),
    )
    expect(result.turns).toEqual([])
    expect(result.rawBytes).toBe(0)
  })

  it('parses user + assistant turns within window', () => {
    const jsonl = [
      JSON.stringify({ type: 'agent-setting', agentSetting: 'marley' }),
      JSON.stringify({
        type: 'user',
        isSidechain: false,
        timestamp: '2026-05-11T12:00:00Z',
        sessionId: 'sess-A',
        message: { role: 'user', content: [{ type: 'text', text: 'hola agent' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        isSidechain: false,
        timestamp: '2026-05-11T12:00:01Z',
        sessionId: 'sess-A',
        message: { role: 'assistant', content: [{ type: 'text', text: 'qué tal Juan' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        isSidechain: true,
        timestamp: '2026-05-11T12:00:02Z',
        sessionId: 'sess-A',
        message: { role: 'assistant', content: [{ type: 'text', text: 'sidechain — debe ignorarse' }] },
      }),
      JSON.stringify({
        type: 'user',
        isSidechain: false,
        timestamp: '2026-05-10T12:00:00Z', // FUERA del window
        sessionId: 'sess-A',
        message: { role: 'user', content: [{ type: 'text', text: 'ayer' }] },
      }),
    ].join('\n')
    const filePath = join(tmpDir, 'sess-A.jsonl')
    writeFileSync(filePath, jsonl, 'utf8')

    const result = fetchDailyChatContext(
      {
        startUtc: new Date('2026-05-11T06:00:00Z'),
        endUtc: new Date('2026-05-12T06:00:00Z'),
        isoDate: '2026-05-11',
        tz: 'America/Mexico_City',
      },
      tmpDir,
    )

    expect(result.turns).toHaveLength(2)
    expect(result.turns[0]?.role).toBe('user')
    expect(result.turns[0]?.text).toBe('hola agent')
    expect(result.turns[1]?.role).toBe('assistant')
    expect(result.turns[1]?.text).toBe('qué tal Juan')
    expect(result.sessionsTouched).toEqual(['sess-A'])
  })

  it('skips malformed JSON lines without aborting', () => {
    const jsonl = [
      'not json',
      JSON.stringify({
        type: 'user',
        isSidechain: false,
        timestamp: '2026-05-11T12:00:00Z',
        sessionId: 'sess-A',
        message: { role: 'user', content: [{ type: 'text', text: 'válido' }] },
      }),
      '',
      '{invalid',
    ].join('\n')
    writeFileSync(join(tmpDir, 'sess.jsonl'), jsonl, 'utf8')

    const result = fetchDailyChatContext(
      {
        startUtc: new Date('2026-05-11T06:00:00Z'),
        endUtc: new Date('2026-05-12T06:00:00Z'),
        isoDate: '2026-05-11',
        tz: 'America/Mexico_City',
      },
      tmpDir,
    )

    expect(result.turns).toHaveLength(1)
    expect(result.turns[0]?.text).toBe('válido')
  })

  it('sorts turns chronologically across multiple session files', () => {
    const sA = [
      JSON.stringify({
        type: 'user',
        isSidechain: false,
        timestamp: '2026-05-11T18:00:00Z',
        sessionId: 'A',
        message: { role: 'user', content: [{ type: 'text', text: 'A-late' }] },
      }),
    ].join('\n')
    const sB = [
      JSON.stringify({
        type: 'user',
        isSidechain: false,
        timestamp: '2026-05-11T08:00:00Z',
        sessionId: 'B',
        message: { role: 'user', content: [{ type: 'text', text: 'B-early' }] },
      }),
    ].join('\n')
    writeFileSync(join(tmpDir, 'A.jsonl'), sA, 'utf8')
    writeFileSync(join(tmpDir, 'B.jsonl'), sB, 'utf8')

    const result = fetchDailyChatContext(
      {
        startUtc: new Date('2026-05-11T06:00:00Z'),
        endUtc: new Date('2026-05-12T06:00:00Z'),
        isoDate: '2026-05-11',
        tz: 'America/Mexico_City',
      },
      tmpDir,
    )
    expect(result.turns.map(t => t.text)).toEqual(['B-early', 'A-late'])
  })
})

// ─── extractFactsWithLLM ─────────────────────────────────────────────────

describe('extractFactsWithLLM', () => {
  it('returns [] for empty turns without calling SDK', async () => {
    const facts = await extractFactsWithLLM([], '2026-05-11', 'claude-sonnet-4-5')
    expect(facts).toEqual([])
    expect(hoisted.mockQuery).not.toHaveBeenCalled()
  })

  it('parses SDK result event into facts', async () => {
    hoisted.mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { type: 'system', subtype: 'init', session_id: 'extractor-1' }
        yield {
          type: 'result',
          result: '{"facts":[{"content":"Juan está testeando consolidación","entity":"juan-lara","tags":["test"]}]}',
        }
      },
    })

    const facts = await extractFactsWithLLM(
      [{ role: 'user', text: 'estoy testeando', timestamp: '2026-05-11T10:00:00Z', sessionId: 's1' }],
      '2026-05-11',
      'claude-sonnet-4-5',
    )

    expect(facts).toHaveLength(1)
    expect(facts[0]?.content).toBe('Juan está testeando consolidación')
    expect(hoisted.mockQuery).toHaveBeenCalledOnce()
    const args = hoisted.mockQuery.mock.calls[0]?.[0] as { options: { model: string; settingSources: unknown[] } }
    expect(args.options.model).toBe('claude-sonnet-4-5')
    expect(args.options.settingSources).toEqual([])
  })

  it('throws ExtractorError on empty SDK result', async () => {
    hoisted.mockQuery.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { type: 'system', subtype: 'init' }
      },
    })
    await expect(
      extractFactsWithLLM(
        [{ role: 'user', text: 'x', timestamp: '2026-05-11T10:00:00Z', sessionId: 's1' }],
        '2026-05-11',
        'claude-sonnet-4-5',
      ),
    ).rejects.toThrow(/empty result/)
  })
})

// ─── persistFacts ─────────────────────────────────────────────────────────

describe('persistFacts', () => {
  it('inserts new facts and skips existing by content_hash', async () => {
    hoisted.mockEmbedText.mockResolvedValue(new Array(1536).fill(0.1))
    // Shared state: el 1er maybeSingle retorna null (insertar), el 2do retorna existing (skip).
    const maybeSingleMock = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
        })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
      })),
    } as never

    const result = await persistFacts(
      client,
      [
        { content: 'hecho 1', entity: 'op', tags: ['t'], importance: 1.0 },
        { content: 'hecho 2', entity: null, tags: [], importance: 1.0 },
      ],
      '2026-05-11',
      ['sess-A'],
    )

    expect(result.inserted).toBe(1)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
  })

  it('skips on 23505 race-condition unique violation', async () => {
    hoisted.mockEmbedText.mockResolvedValue(new Array(1536).fill(0.1))
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
        insert: vi.fn(() =>
          Promise.resolve({
            error: { code: '23505', message: 'duplicate key value' },
          }),
        ),
      })),
    } as never

    const result = await persistFacts(client, [{ content: 'x' }], '2026-05-11', [])
    expect(result.inserted).toBe(0)
    expect(result.skipped).toBe(1)
    expect(result.errors).toBe(0)
  })

  it('propagates EmbeddingNotConfiguredError', async () => {
    hoisted.mockEmbedText.mockRejectedValue(new hoisted.FakeEmbeddingNotConfiguredError())
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      })),
    } as never

    await expect(persistFacts(client, [{ content: 'x' }], '2026-05-11', [])).rejects.toThrow(
      /embeddings provider not configured/,
    )
  })

  it('counts errors on SELECT/embed/insert failures separately', async () => {
    hoisted.mockEmbedText.mockResolvedValue(new Array(1536).fill(0.1))
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'rls denied' } }),
            })),
          })),
        })),
      })),
    } as never

    const result = await persistFacts(client, [{ content: 'x' }], '2026-05-11', [])
    expect(result.errors).toBe(1)
    expect(result.inserted).toBe(0)
  })
})

// ─── writeMemoryToolFile ──────────────────────────────────────────────────

describe('writeMemoryToolFile', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'aios-consolidate-md-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns null for empty facts', () => {
    expect(writeMemoryToolFile([], '2026-05-11', tmpDir)).toBeNull()
  })

  it('writes frontmatter + bullets', () => {
    const path = writeMemoryToolFile(
      [
        { content: 'Juan vive en Guadalajara', entity: 'juan-lara', tags: ['location'], importance: 1.0 },
        { content: 'El gato se llama Pelusa', entity: 'pelusa', tags: ['pet'], importance: 1.0 },
      ],
      '2026-05-11',
      tmpDir,
    )
    expect(path).toBeTruthy()
    const body = readFileSync(path!, 'utf8')
    expect(body).toContain('iso_date: 2026-05-11')
    expect(body).toContain('fact_count: 2')
    expect(body).toContain('**juan-lara** — Juan vive en Guadalajara')
    expect(body).toContain('**pelusa** — El gato se llama Pelusa')
  })

  it('merges defensively without duplicating bullets', () => {
    const path1 = writeMemoryToolFile(
      [{ content: 'Hecho A', entity: 'op', tags: [], importance: 1.0 }],
      '2026-05-11',
      tmpDir,
    )
    const path2 = writeMemoryToolFile(
      [
        { content: 'Hecho A', entity: 'op', tags: [], importance: 1.0 }, // duplicado
        { content: 'Hecho B', entity: 'op', tags: [], importance: 1.0 }, // nuevo
      ],
      '2026-05-11',
      tmpDir,
    )
    expect(path1).toBe(path2)
    const body = readFileSync(path2!, 'utf8')
    const lines = body.split('\n').filter(l => l.startsWith('- '))
    expect(lines).toHaveLength(2)
    expect(body).toContain('fact_count: 2')
  })
})

// ─── applyLifecycle ──────────────────────────────────────────────────────

describe('applyLifecycle', () => {
  it('invokes decay + compact RPCs with config', async () => {
    hoisted.mockRpc.mockResolvedValueOnce({ data: 7, error: null }).mockResolvedValueOnce({ data: 3, error: null })
    const client = { rpc: hoisted.mockRpc } as never

    const result = await applyLifecycle(client, {
      model: 'x',
      decayFactor: 0.9,
      decayAgeDays: 14,
      decayHits: 2,
      compactThreshold: 0.05,
    })

    expect(result).toEqual({ decayedRows: 7, deletedRows: 3 })
    expect(hoisted.mockRpc).toHaveBeenNthCalledWith(1, 'decay_agent_memories', {
      decay_factor: 0.9,
      age_days: 14,
      hits_threshold: 2,
    })
    expect(hoisted.mockRpc).toHaveBeenNthCalledWith(2, 'compact_agent_memories', { threshold: 0.05 })
  })

  it('tolerates RPC errors by returning 0 + WARN', async () => {
    hoisted.mockRpc
      .mockResolvedValueOnce({ data: null, error: { message: 'fn not found' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'fn not found' } })
    const client = { rpc: hoisted.mockRpc } as never

    const result = await applyLifecycle(client, {
      model: 'x',
      decayFactor: 0.9,
      decayAgeDays: 14,
      decayHits: 2,
      compactThreshold: 0.05,
    })

    expect(result).toEqual({ decayedRows: 0, deletedRows: 0 })
  })
})

// ─── loadConsolidationConfig ──────────────────────────────────────────────

describe('loadConsolidationConfig', () => {
  it('uses defaults when env empty', () => {
    hoisted.mockReadEnvFile.mockReturnValue({})
    const config = loadConsolidationConfig()
    expect(config).toEqual(CONSOLIDATION_DEFAULTS)
  })

  it('honors env overrides', () => {
    hoisted.mockReadEnvFile.mockReturnValue({
      MEMORY_CONSOLIDATION_MODEL: 'claude-haiku-test',
      MEMORY_DECAY_FACTOR: '0.8',
      MEMORY_DECAY_AGE_DAYS: '14',
      MEMORY_DECAY_HITS: '5',
      MEMORY_COMPACT_THRESHOLD: '0.2',
    })
    const config = loadConsolidationConfig()
    expect(config.model).toBe('claude-haiku-test')
    expect(config.decayFactor).toBe(0.8)
    expect(config.decayAgeDays).toBe(14)
    expect(config.decayHits).toBe(5)
    expect(config.compactThreshold).toBe(0.2)
  })

  it('falls back to defaults on garbage env values', () => {
    hoisted.mockReadEnvFile.mockReturnValue({
      MEMORY_DECAY_FACTOR: 'NaN',
      MEMORY_DECAY_AGE_DAYS: 'abc',
    })
    const config = loadConsolidationConfig()
    expect(config.decayFactor).toBe(CONSOLIDATION_DEFAULTS.decayFactor)
    expect(config.decayAgeDays).toBe(CONSOLIDATION_DEFAULTS.decayAgeDays)
  })
})

// Silenciar warnings de TS sobre vars unused (imports usados solo en assertions)
void existsSync
