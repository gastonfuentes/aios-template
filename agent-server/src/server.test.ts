/**
 * Tests de integración mínima del HTTP server (PRP-017 — no-blocking).
 *
 * Monta el server en puerto alt (3999) con todas las deps pesadas mockeadas,
 * y verifica:
 *  - GET /healthz responde 200 sin bearer (es público).
 *  - GET /sessions sin Authorization → 401.
 *  - GET /sessions con bearer inválido → 401.
 *  - OPTIONS /healthz (preflight CORS) → 204 con headers correctos.
 *
 * NOT cubierto: chat/stream, sessions full path, schedule endpoints (acoplados
 * al SDK + DB real). Decisión consciente PRP-017.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

vi.mock('./env.js', () => ({
  readEnvFile: vi.fn(() => ({
    OPENCLAW_GATEWAY_TOKEN: 'test-token-1234567890abcdef',
    MISSION_CONTROL_ORIGIN: 'https://YOUR_MC_PUBLIC_URL,http://localhost:3000',
    MISSION_CONTROL_TOKEN: 'mc-test-token-abcdef',
  })),
  validateRequiredEnv: vi.fn(),
  DAEMON_REQUIRED_ENV: [],
}))

vi.mock('./config.js', () => ({
  MC_SERVER_PORT: 3999,
  PROJECT_ROOT: '/tmp/test-aios',
  ALLOWED_CHAT_ID: 'BOOTSTRAP',
  SCHEDULER_TZ: 'America/Mexico_City',
}))

vi.mock('./agent.js', () => ({
  getAvailableModels: vi.fn().mockResolvedValue([]),
  isSdkPrewarmed: vi.fn(() => true),
  runAgentStream: vi.fn(),
  getCurrentModel: vi.fn(() => 'claude-opus-4-7'),
  setCurrentModel: vi.fn(),
  getContextInfo: vi.fn(() => ({ used: null, total: null })),
}))

// PRP-034: mocks de db ampliados para POST/PATCH/DELETE /schedule.
const { mockTaskExists, mockGetTask, mockCreateTask, mockUpdateTaskFields, mockDeleteTask } = vi.hoisted(() => ({
  mockTaskExists: vi.fn<(id: string) => boolean>(),
  mockGetTask: vi.fn<(id: string) => unknown>(),
  mockCreateTask: vi.fn<(t: unknown) => void>(),
  mockUpdateTaskFields: vi.fn<(id: string, fields: unknown) => void>(),
  mockDeleteTask: vi.fn<(id: string) => void>(),
}))

vi.mock('./db.js', () => ({
  getUsageSummary: vi.fn(() => []),
  getSession: vi.fn(() => null),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  saveQueryUsage: vi.fn(),
  listTasks: vi.fn(() => []),
  getTask: (...args: unknown[]) => mockGetTask(...(args as [string])),
  updateTaskStatus: vi.fn(),
  updateTaskFields: (...args: unknown[]) =>
    mockUpdateTaskFields(...(args as [string, unknown])),
  createTask: (...args: unknown[]) => mockCreateTask(...(args as [unknown])),
  deleteTask: (...args: unknown[]) => mockDeleteTask(...(args as [string])),
  taskExists: (...args: unknown[]) => mockTaskExists(...(args as [string])),
  getDb: vi.fn(),
}))

vi.mock('./scheduler.js', () => ({
  runDueTasks: vi.fn(),
  // PRP-034: computeNextRun consumido por POST /schedule + PATCH /schedule/:id.
  // Mock: schedule válido `* * * * *` retorna timestamp futuro; cualquier otro
  // string throw para simular cron-parser invalid.
  computeNextRun: vi.fn((expr: string) => {
    if (expr === '* * * * *' || expr === '0 9 * * 1') {
      return Math.floor(Date.now() / 1000) + 60
    }
    throw new Error(`Invalid cron: ${expr}`)
  }),
}))

vi.mock('./ops-logger.js', () => ({
  opsLogger: {
    log: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getRecent: vi.fn(() => []),
  },
}))

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  listSessions: vi.fn().mockResolvedValue([]),
  getSessionMessages: vi.fn().mockResolvedValue([]),
}))

// PRP-026 mocks: embed + recall. Definir clases vía vi.hoisted() porque vi.mock
// factories se hoistean al top y no pueden referenciar variables top-level
// definidas en orden léxico.
const { mockEmbedText, mockRecallMemories, FakeEmbeddingError, FakeEmbeddingNotConfiguredError, FakeRecallError, FakeRecallNotConfiguredError } = vi.hoisted(() => {
  class FakeEmbeddingNotConfiguredError extends Error {
    status = 503
    retryable = false
    constructor() {
      super('embeddings provider not configured')
      this.name = 'EmbeddingNotConfiguredError'
    }
  }
  class FakeEmbeddingError extends Error {
    constructor(public readonly status: number, public readonly retryable: boolean, message: string) {
      super(message)
      this.name = 'EmbeddingError'
    }
  }
  class FakeRecallNotConfiguredError extends Error {
    status = 503
    constructor(missing: string) {
      super(`recall not configured: missing ${missing}`)
      this.name = 'RecallNotConfiguredError'
    }
  }
  class FakeRecallError extends Error {
    constructor(public readonly status: number, message: string) {
      super(message)
      this.name = 'RecallError'
    }
  }
  return {
    mockEmbedText: vi.fn(),
    mockRecallMemories: vi.fn(),
    FakeEmbeddingNotConfiguredError,
    FakeEmbeddingError,
    FakeRecallNotConfiguredError,
    FakeRecallError,
  }
})

vi.mock('./embed.js', () => ({
  embedText: (...args: unknown[]) => mockEmbedText(...args),
  EmbeddingError: FakeEmbeddingError,
  EmbeddingNotConfiguredError: FakeEmbeddingNotConfiguredError,
  EMBEDDING_DIMENSIONS: 1536,
}))

vi.mock('./recall.js', () => ({
  recallMemories: (...args: unknown[]) => mockRecallMemories(...args),
  RecallError: FakeRecallError,
  RecallNotConfiguredError: FakeRecallNotConfiguredError,
  clampLimit: (raw: unknown) => {
    const n = typeof raw === 'string' ? parseInt(raw, 10) : typeof raw === 'number' ? raw : NaN
    if (!Number.isFinite(n)) return 5
    return Math.max(1, Math.min(Math.trunc(n), 20))
  },
}))

import { startMCServer, stopMCServer } from './server.js'

const BASE = 'http://127.0.0.1:3999'

describe('HTTP server integration smoke', () => {
  beforeAll(() => {
    startMCServer()
  })

  afterAll(async () => {
    await stopMCServer()
  })

  it('GET /healthz responde 200 sin bearer (público)', async () => {
    const res = await fetch(`${BASE}/healthz`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.uptime).toBe('number')
    expect(typeof body.pid).toBe('number')
    expect(body.sdkPrewarmed).toBe(true)
  })

  it('GET /sessions sin Authorization header → 401', async () => {
    const res = await fetch(`${BASE}/sessions`)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('GET /sessions con bearer inválido → 401', async () => {
    const res = await fetch(`${BASE}/sessions`, {
      headers: { Authorization: 'Bearer wrong-token' },
    })
    expect(res.status).toBe(401)
  })

  it('OPTIONS preflight retorna 204 con CORS headers correctos', async () => {
    const res = await fetch(`${BASE}/healthz`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://YOUR_MC_PUBLIC_URL',
        'Access-Control-Request-Method': 'GET',
      },
    })
    expect(res.status).toBe(204)
    // Echo-back del origin (multi-origin CORS PRP-010)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://YOUR_MC_PUBLIC_URL')
    expect(res.headers.get('Vary')).toBe('Origin')
  })

  it('CORS allowed-origin no listado retorna el default origin', async () => {
    const res = await fetch(`${BASE}/healthz`, {
      headers: { Origin: 'https://evil.example.com' },
    })
    // Para origin no listado, server retorna el primer origin permitido (PRP-010).
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://YOUR_MC_PUBLIC_URL')
  })

  // ── PRP-026 endpoints: POST /embed + GET /recall ─────────────────────────────

  const VALID_BEARER = 'Bearer test-token-1234567890abcdef'

  it('POST /embed sin bearer → 401', async () => {
    const res = await fetch(`${BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hola' }),
    })
    expect(res.status).toBe(401)
  })

  it('POST /embed con bearer + texto válido → 200 con embedding 1536d', async () => {
    const vec = new Array(1536).fill(0.01)
    mockEmbedText.mockResolvedValueOnce(vec)
    const res = await fetch(`${BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: VALID_BEARER },
      body: JSON.stringify({ text: 'hola' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.embedding).toHaveLength(1536)
    expect(body.dimensions).toBe(1536)
    expect(body.model).toBe('text-embedding-3-small')
  })

  it('POST /embed body inválido (missing text) → 400', async () => {
    const res = await fetch(`${BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: VALID_BEARER },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('POST /embed body no-JSON → 400', async () => {
    const res = await fetch(`${BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: VALID_BEARER },
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })

  it('POST /embed sin OPENAI_API_KEY → 503', async () => {
    mockEmbedText.mockRejectedValueOnce(new FakeEmbeddingNotConfiguredError())
    const res = await fetch(`${BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: VALID_BEARER },
      body: JSON.stringify({ text: 'hola' }),
    })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toMatch(/embeddings provider not configured/)
  })

  it('POST /embed upstream error retryable → 502', async () => {
    mockEmbedText.mockRejectedValueOnce(new FakeEmbeddingError(429, true, 'rate limit'))
    const res = await fetch(`${BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: VALID_BEARER },
      body: JSON.stringify({ text: 'hola' }),
    })
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.retryable).toBe(true)
  })

  it('GET /recall sin bearer → 401', async () => {
    const res = await fetch(`${BASE}/recall?query=test`)
    expect(res.status).toBe(401)
  })

  it('GET /recall con bearer + query → 200 con memories array', async () => {
    const sampleRows = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        content: 'sample',
        tags: [],
        entity: null,
        importance: 1.0,
        accessed_count: 0,
        last_accessed_at: null,
        created_at: '2026-05-12T00:00:00Z',
        source: 'sample',
        similarity: 0.9,
      },
    ]
    mockRecallMemories.mockResolvedValueOnce(sampleRows)
    const res = await fetch(`${BASE}/recall?query=test&limit=3`, {
      headers: { Authorization: VALID_BEARER },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.memories).toEqual(sampleRows)
    expect(body.query).toBe('test')
    expect(body.limit).toBe(3)
    expect(mockRecallMemories).toHaveBeenCalledWith('test', { limit: 3 })
  })

  it('GET /recall sin query param → 400', async () => {
    const res = await fetch(`${BASE}/recall`, { headers: { Authorization: VALID_BEARER } })
    expect(res.status).toBe(400)
  })

  it('GET /recall sin OPENAI_API_KEY → 503', async () => {
    mockRecallMemories.mockRejectedValueOnce(new FakeRecallNotConfiguredError('embeddings'))
    const res = await fetch(`${BASE}/recall?query=test`, {
      headers: { Authorization: VALID_BEARER },
    })
    expect(res.status).toBe(503)
  })

  it('GET /recall clamp limit a default cuando es inválido', async () => {
    mockRecallMemories.mockResolvedValueOnce([])
    const res = await fetch(`${BASE}/recall?query=test&limit=invalid`, {
      headers: { Authorization: VALID_BEARER },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.limit).toBe(5)
  })

  // ── PRP-034 Sub-fase 2: POST/PATCH/DELETE /schedule ────────────────────────

  it('POST /schedule con cron válido → 201 con task shape', async () => {
    mockTaskExists.mockReturnValueOnce(false)
    mockGetTask.mockReturnValueOnce({
      id: 'test-job-1',
      chat_id: 'mc-web',
      thread_id: null,
      prompt: 'do thing',
      schedule: '* * * * *',
      next_run: Math.floor(Date.now() / 1000) + 60,
      last_run: null,
      last_result: null,
      status: 'active',
      created_at: Math.floor(Date.now() / 1000),
    })
    const res = await fetch(`${BASE}/schedule`, {
      method: 'POST',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'test-job-1',
        prompt: 'do thing',
        schedule: '* * * * *',
      }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.task).toBeDefined()
    expect(body.task.id).toBe('test-job-1')
    expect(mockCreateTask).toHaveBeenCalled()
  })

  it('POST /schedule con cron inválido → 400 con invalid_cron', async () => {
    const res = await fetch(`${BASE}/schedule`, {
      method: 'POST',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'test-job-bad',
        prompt: 'do thing',
        schedule: 'not-a-cron',
      }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('invalid_cron')
    expect(body.detail).toContain('Invalid cron')
  })

  it('POST /schedule con id existente → 409', async () => {
    mockTaskExists.mockReturnValueOnce(true)
    const res = await fetch(`${BASE}/schedule`, {
      method: 'POST',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 'duplicate',
        prompt: 'p',
        schedule: '* * * * *',
      }),
    })
    expect(res.status).toBe(409)
  })

  it('POST /schedule sin id → 400', async () => {
    const res = await fetch(`${BASE}/schedule`, {
      method: 'POST',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'p', schedule: '* * * * *' }),
    })
    expect(res.status).toBe(400)
  })

  it('PATCH /schedule/:id con prompt + schedule → 200', async () => {
    mockTaskExists.mockReturnValueOnce(true)
    mockGetTask.mockReturnValueOnce({
      id: 'patch-test',
      chat_id: 'mc-web',
      thread_id: null,
      prompt: 'new prompt',
      schedule: '0 9 * * 1',
      next_run: Math.floor(Date.now() / 1000) + 60,
      last_run: null,
      last_result: null,
      status: 'active',
      created_at: 0,
    })
    const res = await fetch(`${BASE}/schedule/patch-test`, {
      method: 'PATCH',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'new prompt', schedule: '0 9 * * 1' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateTaskFields).toHaveBeenCalled()
  })

  it('PATCH /schedule/:id de task inexistente → 404', async () => {
    mockTaskExists.mockReturnValueOnce(false)
    const res = await fetch(`${BASE}/schedule/missing`, {
      method: 'PATCH',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'x' }),
    })
    expect(res.status).toBe(404)
  })

  it('DELETE /schedule/:id existente → 200', async () => {
    mockTaskExists.mockReturnValueOnce(true)
    const res = await fetch(`${BASE}/schedule/del-target`, {
      method: 'DELETE',
      headers: { Authorization: VALID_BEARER },
    })
    expect(res.status).toBe(200)
    expect(mockDeleteTask).toHaveBeenCalledWith('del-target')
  })

  it('DELETE /schedule/:id inexistente → 404', async () => {
    mockTaskExists.mockReturnValueOnce(false)
    const res = await fetch(`${BASE}/schedule/ghost`, {
      method: 'DELETE',
      headers: { Authorization: VALID_BEARER },
    })
    expect(res.status).toBe(404)
  })

  // ── PRP-034 Sub-fase 4: POST /open-url ────────────────────────────────────

  it('POST /open-url sin url → 400', async () => {
    const res = await fetch(`${BASE}/open-url`, {
      method: 'POST',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('POST /open-url con url no-http → 400', async () => {
    const res = await fetch(`${BASE}/open-url`, {
      method: 'POST',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'file:///etc/passwd' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /open-url con target inválido → 400', async () => {
    const res = await fetch(`${BASE}/open-url`, {
      method: 'POST',
      headers: {
        Authorization: VALID_BEARER,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: 'https://example.com', target: 'bogus' }),
    })
    expect(res.status).toBe(400)
  })

  it('POST /open-url sin bearer → 401', async () => {
    const res = await fetch(`${BASE}/open-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    })
    expect(res.status).toBe(401)
  })
})
