/**
 * HTTP server local del daemon — `127.0.0.1:3099`.
 *
 * Endpoints servidos al cierre de Fase 5 (suma del subset Fase 4 + nuevos Fase 5):
 *
 *   GET  /healthz                       → { ok, uptime, pid, sdkPrewarmed }            (Fase 4)
 *   GET  /models                        → modelos dinámicos del SDK (FIX 2)            (Fase 4)
 *   GET  /usage?days=N                  → agregado de query_usage                       (Fase 4)
 *   GET  /ops/stream                    → SSE de OpsEvent                               (Fase 4)
 *   GET  /ops/recent?limit=N            → snapshot                                      (Fase 4)
 *   POST /chat/stream                   → SSE de SSEEvent (chat con SDK)                (Fase 5)
 *   POST /chat/interrupt                → abortar query activa                          (Fase 5)
 *   POST /newchat                       → clear session                                 (Fase 5)
 *   GET  /commands                      → slash command palette                         (Fase 5)
 *   GET  /sessions?limit=N              → list SDK sessions enriched con linkedChatSessionId (Fase 5)
 *   GET  /sessions/:id/messages         → mensajes raw de sesión SDK                    (Fase 5)
 *   GET  /schedule                      → list de scheduled_tasks                       (Fase 7)
 *   POST /schedule/:id/run              → forzar ejecución inmediata de un job          (Fase 7)
 *   POST /schedule/:id/pause            → status='paused'                               (Fase 7)
 *   POST /schedule/:id/resume           → status='active'                               (Fase 7)
 *
 * Auth: `Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>` con `timingSafeEqual`.
 *   Excepción: `/healthz` es público (PRP-010 Refinamiento) — payload no-secreto,
 *   habilita health checks externos (UptimeRobot etc.) sin distribuir el bearer.
 * CORS: multi-origin desde `MISSION_CONTROL_ORIGIN` (CSV). Bind: 127.0.0.1 (no 0.0.0.0).
 *
 * NOTA Fase 5: cero memory injection (FIX 4). El handler `/chat/stream` NO llama
 * `buildMemoryContext` ni `wrapMemoryContext` ni inyecta memoria automática.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { timingSafeEqual } from 'crypto'
import { listSessions, getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import { readEnvFile } from './env.js'
import { MC_SERVER_PORT, PROJECT_ROOT } from './config.js'
import {
  getAvailableModels,
  isSdkPrewarmed,
  runAgentStream,
  getCurrentModel,
  setCurrentModel,
  getContextInfo,
  type ModelInfo,
  type Query,
  type EffortLevel,
} from './agent.js'
import {
  getUsageSummary,
  getSession,
  setSession,
  clearSession,
  saveQueryUsage,
  listTasks,
  getTask,
  updateTaskStatus,
  updateTaskFields,
  createTask,
  deleteTask,
  taskExists,
  getDb,
} from './db.js'
import { runDueTasks, computeNextRun } from './scheduler.js'
import { spawn } from 'child_process'
import { opsLogger, type OpsEvent } from './ops-logger.js'
import { logger } from './logger.js'
import { validateInput } from './security.js'
import { embedText, EmbeddingError, EmbeddingNotConfiguredError, EMBEDDING_DIMENSIONS } from './embed.js'
import { recallMemories, RecallError, RecallNotConfiguredError, clampLimit } from './recall.js'
import { transcribeAudioBuffer } from './voice.js'
import { extractBoundary, parseMultipartBody, readBodyAsBuffer, MultipartParseError } from './multipart.js'

// ─── Config ──────────────────────────────────────────────────────────────────

const env = readEnvFile([
  'OPENCLAW_GATEWAY_TOKEN',
  'MISSION_CONTROL_ORIGIN',
  'MISSION_CONTROL_TOKEN',
  'MC_BASE_URL',
])
const MC_TOKEN = env['OPENCLAW_GATEWAY_TOKEN'] ?? ''
const ALLOWED_ORIGINS = (env['MISSION_CONTROL_ORIGIN'] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const MC_BACKEND_TOKEN = env['MISSION_CONTROL_TOKEN'] ?? MC_TOKEN
/**
 * Base URL al que el daemon postea webhooks fire-and-forget al MC backend
 * (`/api/openclaw/event` para ops, `/api/chat/complete` para always-push de chat).
 *
 * Fallback canónico (PRP-029 refinamiento crítico): si `MC_BASE_URL` no está
 * sembrado en `agent-server/.env`, caer a `ALLOWED_ORIGINS[0]`. El comportamiento
 * histórico era depender de `ALLOWED_ORIGINS[0]` directamente, pero la convención
 * de poner `http://localhost:3000` primero en el CSV (para el dev workflow del
 * operador, por convención dev workflow) hacía que en producción los webhooks cayeran a
 * localhost que no existe. Sembrar `MC_BASE_URL=https://YOUR_MC_PUBLIC_URL`
 * resuelve el always-push en prod sin romper dev (dev puede omitir la var y
 * el fallback usa el primer origen del CSV = localhost).
 */
const MC_BASE_URL = env['MC_BASE_URL'] ?? ALLOWED_ORIGINS[0] ?? ''

/**
 * Multi-origin CORS (PRP-010 Refinamiento 7 cerrado): split CSV + match exact +
 * echo-back. CORS con `*` no funciona junto con bearer/cookies — los browsers
 * exigen el origin específico de la request en `Access-Control-Allow-Origin`.
 */
function pickAllowedOrigin(req: IncomingMessage): string {
  const origin = req.headers.origin
  if (typeof origin === 'string' && ALLOWED_ORIGINS.includes(origin)) {
    return origin
  }
  // Sin origin (curl, mismo daemon a sí mismo) o no listado: usar el primero
  // como default informativo. Browser de origin ajeno NO pasa el preflight.
  return ALLOWED_ORIGINS[0] ?? ''
}

const BOOT_TIME = Date.now()

let httpServer: Server | null = null

// Module-level state para chat streaming (último gana — segunda invocación cancela primera).
let activeQuery: Query | null = null
let activeStream: { interrupted: boolean; clientConnected: boolean } | null = null

// Cache /sessions 60s para no spawnear listSessions en cada keystroke del sidebar.
let sessionsCache: { data: unknown[]; ts: number } | null = null
const SESSIONS_CACHE_TTL = 60_000

// SESSION_KEY constante: fallback cuando MC no envía chatSessionId (primer mensaje
// pre-create, o legacy clients). El brief la lista como "safety net documentado
// pero no servir por defecto" — el frontend pre-crea session antes del primer
// mensaje y el chatSessionId real toma precedencia en la práctica.
const SESSION_KEY_FALLBACK = 'mc-web'

function isTokenValid(provided: string): boolean {
  if (!MC_TOKEN) return false
  if (provided.length !== MC_TOKEN.length) return false
  return timingSafeEqual(Buffer.from(provided), Buffer.from(MC_TOKEN))
}

// ─── Helpers compartidos ─────────────────────────────────────────────────────

function setCORSHeaders(res: ServerResponse, origin: string): void {
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
  })
}

// Cache /models para evitar spawn de subprocess SDK en cada request.
let modelsCache: { data: ModelInfo[]; ts: number } | null = null
const MODELS_CACHE_TTL = 60 * 60 * 1000 // 1h

// Shape verbatim del SDK ({ value, displayName, description }) — aprendizaje PRP-004.
const FALLBACK_MODELS: ModelInfo[] = [
  { value: 'claude-opus-4-7', displayName: 'Claude Opus 4.7', description: 'Most capable. Agents and code.' } as unknown as ModelInfo,
  { value: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', description: 'Balance of speed + intelligence.' } as unknown as ModelInfo,
  { value: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', description: 'Fastest. Light tasks.' } as unknown as ModelInfo,
]

// ─── Status helpers (portados del template) ──────────────────────────────────

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  'claude-opus-4-7': 'Claude Opus 4.7',
  'claude-opus-4-6': 'Claude Opus 4.6',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
}

const fmtTokens = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${Math.round(n / 1_000)}K`
  : String(n)

function cronToHuman(cron: string): string {
  const parts = cron.split(/\s+/)
  if (parts.length < 5) return cron
  const [min, hour, dom, , dow] = parts as [string, string, string, string, string]
  const pad = (s: string) => s.padStart(2, '0')

  if (hour.startsWith('*/')) return `every ${hour.slice(2)}h`
  if (min.startsWith('*/')) return `every ${min.slice(2)}min`

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  if (dow !== '*') {
    const idx = parseInt(dow, 10)
    return `${days[idx] ?? dow} ${pad(hour)}:${pad(min)}`
  }
  if (dom !== '*') return `day ${dom} of month ${pad(hour)}:${pad(min)}`

  return `${pad(hour)}:${pad(min)} daily`
}

function buildStatusText(): string {
  const model = getCurrentModel()
  const modelDisplay = model ? MODEL_DISPLAY_NAMES[model] ?? model : null
  const ctx = getContextInfo()
  const cronJobs = listTasks().filter(t => t.status === 'active')

  let s = '**Agent Status**\n\n'

  if (modelDisplay && model) {
    s += `**Model:** ${modelDisplay} (\`${model}\`)\n`
  } else if (model) {
    s += `**Model:** \`${model}\`\n`
  } else {
    s += '**Model:** no data (send a message first)\n'
  }

  if (ctx.used != null && ctx.total != null) {
    const free = ctx.total - ctx.used
    const pctFree = Math.round((free / ctx.total) * 100)
    s += `**Context:** ~${fmtTokens(ctx.used)} / ${fmtTokens(ctx.total)} tokens (${pctFree}% free)\n`
  } else if (ctx.used != null) {
    s += `**Context:** ~${fmtTokens(ctx.used)} tokens used\n`
  } else {
    s += '**Context:** no data\n'
  }
  s += '\n'

  s += `**${cronJobs.length} Active Cron Jobs:**\n`
  cronJobs.forEach((cron, i) => {
    const sched = cronToHuman(cron.schedule)
    s += `${i + 1}. ${cron.id} — ${sched}\n`
  })

  const lastRun = listTasks()
    .filter(t => t.last_run)
    .sort((a, b) => (b.last_run ?? 0) - (a.last_run ?? 0))[0]
  if (lastRun) {
    const snippet = lastRun.last_result
      ? lastRun.last_result.slice(0, 80).replace(/\n/g, ' ')
      : 'no result'
    s += `\n**Last job:** ${lastRun.id} → ${snippet}${(lastRun.last_result?.length ?? 0) > 80 ? '...' : ''}`
  }

  return s
}

// ─── Always-push contract: webhook fire-and-forget al backend de MC ──────────

interface CompletePayload {
  chatSessionId: string | null
  userMessage: string
  assistantMessage: string
  audioUrl: string | null
  imageUrl: string | null
  clientWasConnected: boolean
  // PRP-032 Sub-fase 5 — branching. parentMessageId apunta al USER message
  // que disparó esta rama (las hermanas comparten parent). branchIndex ordena.
  // Solo presente cuando el frontend invoca regenerate (branch:true en /chat/stream).
  parentMessageId?: string | null
  branchIndex?: number
}

function postBackgroundCompletion(payload: CompletePayload): void {
  const base = MC_BASE_URL
  if (!base) return
  fetch(`${base}/api/chat/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MC_BACKEND_TOKEN}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  }).catch((err) => {
    logger.error({ err: String(err) }, 'background completion save failed')
  })
}

// ─── Request handler ─────────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const allowedOrigin = pickAllowedOrigin(req)
  setCORSHeaders(res, allowedOrigin)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // GET /healthz — público (PRP-010 Refinamiento). Sin bearer, sin información
  // secreta. Habilita health checks externos (UptimeRobot u otros) sin
  // distribuir el bearer token.
  if (req.method === 'GET' && req.url === '/healthz') {
    sendJSON(res, 200, {
      ok: true,
      uptime: Math.floor((Date.now() - BOOT_TIME) / 1000),
      pid: process.pid,
      sdkPrewarmed: isSdkPrewarmed(),
    })
    return
  }

  // Auth — bearer required en TODA otra ruta.
  const token = (req.headers['authorization'] ?? '').replace('Bearer ', '')
  if (!isTokenValid(token)) {
    sendJSON(res, 401, { error: 'Unauthorized' })
    return
  }

  // ── Endpoints PRP-004 (subset Fase 4) ──────────────────────────────────────

  // GET /models — FIX 2: dinámicos del SDK con fallback
  if (req.method === 'GET' && req.url === '/models') {
    if (modelsCache && Date.now() - modelsCache.ts < MODELS_CACHE_TTL) {
      sendJSON(res, 200, { models: modelsCache.data, source: 'cache' })
      return
    }

    try {
      const sdkModels = await getAvailableModels()
      const data = sdkModels.length > 0 ? sdkModels : FALLBACK_MODELS
      modelsCache = { data, ts: Date.now() }
      sendJSON(res, 200, { models: data, source: sdkModels.length > 0 ? 'sdk' : 'fallback' })
    } catch (err) {
      logger.warn({ err }, 'getAvailableModels failed; serving fallback')
      sendJSON(res, 200, { models: FALLBACK_MODELS, source: 'fallback' })
    }
    return
  }

  // GET /usage?days=N
  if (req.method === 'GET' && req.url?.startsWith('/usage')) {
    const url = new URL(req.url, `http://localhost:${MC_SERVER_PORT}`)
    const days = parseInt(url.searchParams.get('days') ?? '30', 10)
    const sinceMs = Date.now() - 86_400_000 * days
    sendJSON(res, 200, getUsageSummary(sinceMs))
    return
  }

  // GET /ops/stream — SSE
  if (req.method === 'GET' && req.url === '/ops/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })

    const recent = opsLogger.getRecent(50)
    for (const event of recent.reverse()) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    let connected = true
    const onEvent = (event: OpsEvent) => {
      if (!connected) return
      try { res.write(`data: ${JSON.stringify(event)}\n\n`) } catch { connected = false }
    }
    opsLogger.on('ops', onEvent)

    // keepAlive: 10s (Cloudflare timeout es más corto que 30s, esto previene cierre inesperado)
    const keepAlive = setInterval(() => {
      if (!connected) return
      try { res.write(': ping\n\n') } catch { connected = false }
    }, 10_000)

    // Timeout de conexión: si no hay actividad en 60s, cerrar (previene memory leak de listeners stale)
    const connectionTimeout = setTimeout(() => {
      if (connected) {
        connected = false
        res.end()
      }
    }, 60_000)

    const cleanup = () => {
      connected = false
      opsLogger.off('ops', onEvent)
      clearInterval(keepAlive)
      clearTimeout(connectionTimeout)
    }

    req.on('close', cleanup)
    res.on('close', cleanup)
    res.on('error', cleanup)
    return
  }

  // GET /ops/recent?limit=N
  if (req.method === 'GET' && req.url?.startsWith('/ops/recent')) {
    const url = new URL(req.url, `http://localhost:${MC_SERVER_PORT}`)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)
    sendJSON(res, 200, { events: opsLogger.getRecent(limit) })
    return
  }

  // ── Endpoints Fase 5 (chat + sessions + commands) ──────────────────────────

  // GET /commands — slash command palette (subset estático).
  if (req.method === 'GET' && req.url === '/commands') {
    sendJSON(res, 200, {
      commands: [
        { name: '/clear',   description: 'Nueva conversación — limpiar historial' },
        { name: '/compact', description: 'Comprimir contexto (reducir uso de tokens)' },
        { name: '/status',  description: 'Estado del agente: modelo, contexto, cron jobs' },
        { name: '/model',   description: 'Cambiar el modelo del agente' },
        { name: '/help',    description: 'Mostrar todos los comandos disponibles' },
      ],
    })
    return
  }

  // GET /sessions — listar sesiones SDK + linkedChatSessionId
  if (req.method === 'GET' && req.url?.startsWith('/sessions') && !req.url.includes('/messages')) {
    try {
      const url = new URL(req.url, `http://localhost:${MC_SERVER_PORT}`)
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30', 10), 100)

      let sdkSessions: unknown[]
      if (sessionsCache && Date.now() - sessionsCache.ts < SESSIONS_CACHE_TTL) {
        sdkSessions = sessionsCache.data.slice(0, limit)
      } else {
        sdkSessions = await listSessions({ dir: PROJECT_ROOT, limit })
        sessionsCache = { data: sdkSessions, ts: Date.now() }
      }

      // Lookup reverso: sdk_session_id → chat_session_id
      const allDbSessions = getDb()
        .prepare('SELECT chat_id, session_id FROM sessions')
        .all() as Array<{ chat_id: string; session_id: string }>
      const sdkToMc = new Map(allDbSessions.map((r) => [r.session_id, r.chat_id]))

      const enriched = (sdkSessions as Record<string, unknown>[]).map((s) => ({
        ...s,
        linkedChatSessionId: sdkToMc.get(s['sessionId'] as string) ?? null,
      }))

      sendJSON(res, 200, { sessions: enriched })
    } catch (err) {
      logger.error({ err }, 'listSessions error')
      sendJSON(res, 200, { sessions: [] })
    }
    return
  }

  // GET /sessions/:id/messages
  const sessionsMatch = req.url?.match(/^\/sessions\/([^/?]+)\/messages/)
  if (req.method === 'GET' && sessionsMatch) {
    try {
      const sessionId = sessionsMatch[1]!
      const messages = await getSessionMessages(sessionId, { dir: PROJECT_ROOT })
      sendJSON(res, 200, { messages })
    } catch (err) {
      logger.error({ err }, 'getSessionMessages error')
      sendJSON(res, 200, { messages: [] })
    }
    return
  }

  // POST /chat/interrupt
  if (req.method === 'POST' && req.url === '/chat/interrupt') {
    if (activeStream) activeStream.interrupted = true
    if (activeQuery) {
      try {
        await activeQuery.interrupt()
      } catch (err) {
        logger.warn({ err }, 'interrupt non-fatal error')
      }
      activeQuery = null
    }
    sendJSON(res, 200, { ok: true })
    return
  }

  // POST /newchat — clear session por chatSessionId (default 'mc-web' fallback).
  if (req.method === 'POST' && req.url === '/newchat') {
    const body = await readBody(req)
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(body) } catch { /* empty body OK */ }
    const sessionKey = typeof parsed['chatSessionId'] === 'string'
      ? parsed['chatSessionId']
      : SESSION_KEY_FALLBACK
    clearSession(sessionKey)
    sendJSON(res, 200, { ok: true })
    return
  }

  // POST /chat/stream — SSE streaming endpoint
  if (req.method === 'POST' && req.url === '/chat/stream') {
    const body = await readBody(req)
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(body) } catch { /* */ }

    let message = typeof parsed['message'] === 'string' ? parsed['message'].trim() : ''
    if (!message) {
      sendJSON(res, 400, { error: 'message required' })
      return
    }

    const writeSSE = (event: unknown) => {
      try { res.write(`data: ${JSON.stringify(event)}\n\n`) } catch { /* client gone */ }
    }

    // Intercept /model <name> — cambia modelo sin spawn al SDK.
    const modelMatch = message.match(/^\/model\s+(.+)$/i)
    if (modelMatch) {
      const modelName = modelMatch[1]!.trim()
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      try {
        setCurrentModel(modelName)
        const display = MODEL_DISPLAY_NAMES[modelName] ?? modelName
        writeSSE({ type: 'model_changed', model: modelName })
        writeSSE({ type: 'text_delta', text: `Model changed to **${display}**. The next message will use this model.` })
        writeSSE({ type: 'result', text: `Model changed to **${display}**.` })
      } catch (err) {
        logger.error({ err }, 'setModel error')
        writeSSE({ type: 'error', message: `Failed to switch model: ${String(err)}` })
      } finally {
        res.write('data: [DONE]\n\n')
        res.end()
      }
      return
    }

    // Intercept /status — texto local sin spawn.
    if (message === '/status') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      try {
        const status = buildStatusText()
        writeSSE({ type: 'text_delta', text: status })
        writeSSE({ type: 'result', text: status })
      } catch (err) {
        logger.error({ err }, 'status build error')
        writeSSE({ type: 'error', message: 'Error generando status' })
      } finally {
        res.write('data: [DONE]\n\n')
        res.end()
      }
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    })

    // Cancelar query previa (último gana).
    if (activeStream) activeStream.interrupted = true
    if (activeQuery) {
      try { await activeQuery.interrupt() } catch { /* ignore */ }
      activeQuery = null
    }

    // Validar input — trunca / sanitiza patrones sospechosos.
    message = validateInput(message, 'web-chat')

    const stream = { interrupted: false, clientConnected: true }
    activeStream = stream

    const chatSessionId = typeof parsed['chatSessionId'] === 'string' ? parsed['chatSessionId'] : null
    const sdkSessionIdOverride = typeof parsed['sdkSessionId'] === 'string' ? parsed['sdkSessionId'] : null
    // PRP-032 Sub-fase 5 — branching: parentMessageId del user message que disparó
    // la rama. Cuando presente, el always-push lo propaga al receiver MC, que
    // persiste el assistant como rama hermana con branch_index calculado server-side.
    const parentMessageId = typeof parsed['parentMessageId'] === 'string' ? parsed['parentMessageId'] : null
    // Cuando branch:true, el daemon NO usa resume (arranca conversación fresh).
    // El SDK genera nueva respuesta al user message sin contexto previo. Trade-off
    // documentado: regenerate pierde multi-turn context; aceptable porque el
    // regenerate es local al último turn.
    const isBranching = parsed['branch'] === true
    const audioUrl = typeof parsed['audioUrl'] === 'string' ? parsed['audioUrl'] : null
    // PRP-031 Fase 4: imageUrl paralelo a audioUrl. Cuando viene set, el
    // daemon construye un prompt multimodal para que el SDK Claude Code lo
    // consuma como part `image_url`. El always-push receiver lo persiste a
    // chat_messages.metadata.image_url canónico.
    const imageUrl = typeof parsed['imageUrl'] === 'string' ? parsed['imageUrl'] : null
    const context = typeof parsed['context'] === 'string' ? parsed['context'] : null
    const effortInput = typeof parsed['effort'] === 'string' ? parsed['effort'] : undefined
    const effort: EffortLevel | undefined = effortInput && ['low', 'medium', 'high', 'max'].includes(effortInput)
      ? effortInput as EffortLevel
      : undefined

    const ac = new AbortController()
    const safetyTimeout = setTimeout(() => {
      if (activeQuery) {
        activeQuery.interrupt().catch(() => ac.abort())
      } else {
        ac.abort()
      }
    }, 600_000) // 10 min hard limit

    req.on('close', () => { stream.clientConnected = false })
    res.on('error', () => { stream.clientConnected = false })

    let resultText = ''
    let newSessionId: string | undefined

    try {
      const sessionKey = chatSessionId ?? SESSION_KEY_FALLBACK
      // PRP-032 Sub-fase 5 — branching omite el resume SDK para fresh-start.
      // El SDK genera nueva respuesta al user message sin context previo.
      const sessionId = isBranching
        ? undefined
        : (sdkSessionIdOverride ?? getSession(sessionKey))

      const isCompactCmd = message === '/compact'
      const contextPrefix = context && !isCompactCmd ? `[Context: ${context}]\n\n` : ''
      // PRP-031: si hay imageUrl, anteponer hint en el prompt para que el SDK
      // construya el part multimodal apropiado. El SDK Claude Code 0.2.128
      // consume `image_url` automático cuando detecta una URL de imagen
      // explícitamente referenciada en el prompt. Usar formato markdown
      // imagen para que {{AGENT_NAME}} entienda contexto visual sin requerir refactor
      // del shape `runAgentStream` (que hoy acepta `prompt: string`).
      const imageHint = imageUrl && !isCompactCmd
        ? `[Imagen adjunta: ${imageUrl}]\n\n`
        : ''
      const audioHint = audioUrl && !isCompactCmd
        ? `[Audio adjunto: ${audioUrl}]\n\n`
        : ''
      const fullMessage = isCompactCmd
        ? message
        : contextPrefix + imageHint + audioHint + message

      for await (const event of runAgentStream(fullMessage, sessionId, ac.signal, effort, (q) => {
        activeQuery = q
      })) {
        if (ac.signal.aborted) break

        if (event.type === 'init') newSessionId = event.sessionId
        if (event.type === 'result') resultText = event.text

        // Persistir usage por query.
        if (event.type === 'usage') {
          saveQueryUsage({
            sessionKey,
            costUsd: event.costUsd,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            durationMs: event.durationMs,
            numTurns: event.numTurns,
          })
        }

        if (stream.clientConnected) writeSSE(event)
      }

      // Tras /compact append status fresco.
      if (isCompactCmd && stream.clientConnected) {
        try {
          const statusText = buildStatusText()
          const combined = resultText.trim()
            ? resultText.trim() + '\n\n---\n\n' + statusText
            : statusText
          resultText = combined
          writeSSE({ type: 'result', text: combined })
        } catch { /* best-effort */ }
      }

      // Persist mapeo session_key → SDK sessionId (cross-resumen).
      if (newSessionId) setSession(sessionKey, newSessionId)

      // Always-push contract: POST a /api/chat/complete si no fue interrumpido.
      if (!stream.interrupted && resultText.trim()) {
        postBackgroundCompletion({
          chatSessionId,
          userMessage: message,
          assistantMessage: resultText.trim(),
          audioUrl,
          imageUrl,
          clientWasConnected: stream.clientConnected,
          // PRP-032 Sub-fase 5 — propagar parentMessageId al receiver MC.
          ...(parentMessageId ? { parentMessageId } : {}),
        })
      }
    } catch (err) {
      logger.error({ err }, '/chat/stream error')
      if (stream.clientConnected) {
        writeSSE({ type: 'error', message: String(err) })
      }
    } finally {
      clearTimeout(safetyTimeout)
      activeQuery = null
      if (activeStream === stream) activeStream = null
      if (stream.clientConnected) {
        try {
          res.write('data: [DONE]\n\n')
          res.end()
        } catch { /* client already gone */ }
      }
    }
    return
  }

  // ── Endpoints Fase 7 (cron scheduler) ──────────────────────────────────────

  // GET /schedule — list de scheduled_tasks (consumido por MC `/cron`).
  if (req.method === 'GET' && req.url === '/schedule') {
    sendJSON(res, 200, { tasks: listTasks() })
    return
  }

  // POST /schedule/:id/{run|pause|resume}
  const scheduleActionMatch = req.url?.match(/^\/schedule\/([^/?]+)\/(run|pause|resume)$/)
  if (req.method === 'POST' && scheduleActionMatch) {
    const id = scheduleActionMatch[1]!
    const action = scheduleActionMatch[2]!

    const task = getTask(id)
    if (!task) {
      sendJSON(res, 404, { error: 'Task not found' })
      return
    }

    if (action === 'pause') {
      updateTaskStatus(id, 'paused')
      sendJSON(res, 200, { ok: true, id, status: 'paused' })
      return
    }

    if (action === 'resume') {
      updateTaskStatus(id, 'active')
      sendJSON(res, 200, { ok: true, id, status: 'active' })
      return
    }

    // action === 'run'
    if (task.status !== 'active') {
      sendJSON(res, 409, { error: 'Task is paused — resume first' })
      return
    }
    // Ejecución forzada — runDueTasks(forcedId) ignora next_run y corre el job.
    // Fire-and-forget para no bloquear el HTTP request: el SDK puede tardar.
    void runDueTasks(id).catch((err) => logger.error({ err, id }, 'forced run error'))
    sendJSON(res, 202, { ok: true, id, status: 'running' })
    return
  }

  // ── PRP-034 Sub-fase 2: POST/PATCH/DELETE /schedule ─────────────────────────

  // POST /schedule — crear nuevo cron job
  // Body: { id, prompt, schedule, chat_id?, thread_id? }
  // - id requerido; idempotencia byte-exact (409 si ya existe).
  // - cron expression validada con parseExpression (400 si inválida).
  // - chat_id default 'mc-web' (consumido por scheduler con runAgent('cron')).
  if (req.method === 'POST' && req.url === '/schedule') {
    try {
      const body = await readBody(req)
      const data = JSON.parse(body) as {
        id?: unknown
        prompt?: unknown
        schedule?: unknown
        chat_id?: unknown
        thread_id?: unknown
      }
      if (typeof data.id !== 'string' || !data.id.trim()) {
        sendJSON(res, 400, { error: 'id required (non-empty string)' })
        return
      }
      if (typeof data.prompt !== 'string' || !data.prompt.trim()) {
        sendJSON(res, 400, { error: 'prompt required (non-empty string)' })
        return
      }
      if (typeof data.schedule !== 'string' || !data.schedule.trim()) {
        sendJSON(res, 400, { error: 'schedule required (cron expression)' })
        return
      }
      let nextRun: number
      try {
        nextRun = computeNextRun(data.schedule)
      } catch (err) {
        sendJSON(res, 400, {
          error: 'invalid_cron',
          detail: err instanceof Error ? err.message : String(err),
        })
        return
      }
      if (taskExists(data.id)) {
        sendJSON(res, 409, { error: 'task with this id already exists' })
        return
      }
      const chatId = typeof data.chat_id === 'string' && data.chat_id ? data.chat_id : 'mc-web'
      const threadId = typeof data.thread_id === 'number' ? data.thread_id : null
      createTask({
        id: data.id,
        chat_id: chatId,
        thread_id: threadId,
        prompt: data.prompt,
        schedule: data.schedule,
        next_run: nextRun,
        status: 'active',
        created_at: Math.floor(Date.now() / 1000),
      })
      const created = getTask(data.id)
      sendJSON(res, 201, { task: created })
    } catch (err) {
      logger.error({ err }, '/schedule POST error')
      sendJSON(res, 500, { error: 'internal_error' })
    }
    return
  }

  // PATCH /schedule/:id — editar prompt / schedule
  const scheduleEditMatch = req.url?.match(/^\/schedule\/([^/?]+)$/)
  if (req.method === 'PATCH' && scheduleEditMatch) {
    try {
      const id = scheduleEditMatch[1]!
      if (!taskExists(id)) {
        sendJSON(res, 404, { error: 'task not found' })
        return
      }
      const body = await readBody(req)
      const data = JSON.parse(body) as { prompt?: unknown; schedule?: unknown }
      const fields: { prompt?: string; schedule?: string; next_run?: number } = {}
      if (data.prompt !== undefined) {
        if (typeof data.prompt !== 'string' || !data.prompt.trim()) {
          sendJSON(res, 400, { error: 'prompt must be non-empty string' })
          return
        }
        fields.prompt = data.prompt
      }
      if (data.schedule !== undefined) {
        if (typeof data.schedule !== 'string' || !data.schedule.trim()) {
          sendJSON(res, 400, { error: 'schedule must be non-empty string' })
          return
        }
        try {
          fields.next_run = computeNextRun(data.schedule)
          fields.schedule = data.schedule
        } catch (err) {
          sendJSON(res, 400, {
            error: 'invalid_cron',
            detail: err instanceof Error ? err.message : String(err),
          })
          return
        }
      }
      updateTaskFields(id, fields)
      const updated = getTask(id)
      sendJSON(res, 200, { task: updated })
    } catch (err) {
      logger.error({ err }, '/schedule PATCH error')
      sendJSON(res, 500, { error: 'internal_error' })
    }
    return
  }

  // DELETE /schedule/:id — borrar cron job
  if (req.method === 'DELETE' && scheduleEditMatch) {
    const id = scheduleEditMatch[1]!
    if (!taskExists(id)) {
      sendJSON(res, 404, { error: 'task not found' })
      return
    }
    deleteTask(id)
    sendJSON(res, 200, { ok: true, id })
    return
  }

  // ── PRP-034 Sub-fase 4: POST /open-url ──────────────────────────────────────
  //
  // Body: { url, target?: 'host' | 'push' | 'both' }
  // - target 'host' (default): ejecuta `open <url>` (macOS) / `xdg-open <url>` (Linux)
  //   / `start <url>` (Windows) en la máquina donde corre el daemon — abre browser
  //   default del operador.
  // - target 'push': emite PWA push notification con clients.openWindow(url) en SW.
  // - target 'both': ambos.
  //
  // URL validada (http/https + dominio del operador o localhost). Cross-device: si
  // el daemon vive en un mini-PC/VPS y el operador opera desde su laptop, target 'host'
  // abre en el dispositivo donde corre el daemon; 'push' alcanza el dispositivo activo
  // del operador.
  if (req.method === 'POST' && req.url === '/open-url') {
    try {
      const body = await readBody(req)
      const data = JSON.parse(body) as { url?: unknown; target?: unknown }
      if (typeof data.url !== 'string' || !data.url.trim()) {
        sendJSON(res, 400, { error: 'url required' })
        return
      }
      let parsed: URL
      try {
        parsed = new URL(data.url)
      } catch {
        sendJSON(res, 400, { error: 'invalid_url' })
        return
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        sendJSON(res, 400, { error: 'only http/https allowed' })
        return
      }
      const target = typeof data.target === 'string' ? data.target : 'host'
      if (!['host', 'push', 'both'].includes(target)) {
        sendJSON(res, 400, { error: 'target must be host | push | both' })
        return
      }

      const results: { host?: 'opened' | 'failed'; push?: 'sent' | 'skipped' | 'failed' } = {}

      if (target === 'host' || target === 'both') {
        try {
          // `open` macOS abre el URL en el browser default. Fire-and-forget.
          const proc = spawn('open', [parsed.toString()], { stdio: 'ignore', detached: true })
          proc.unref()
          results.host = 'opened'
        } catch (err) {
          logger.error({ err, url: parsed.toString() }, '/open-url host spawn failed')
          results.host = 'failed'
        }
      }

      if (target === 'push' || target === 'both') {
        // Push notification — delegado al helper notifications.ts en Sub-fase 6.
        // Por ahora marcar como skipped si el helper aún no existe; al cerrar
        // Sub-fase 6 el helper estará vivo y emitirá la notificación.
        try {
          const { sendOpenUrlPush } = await import('./notifications.js').catch(() => ({
            sendOpenUrlPush: null as
              | ((url: string) => Promise<'sent' | 'skipped' | 'failed'>)
              | null,
          }))
          if (sendOpenUrlPush) {
            results.push = await sendOpenUrlPush(parsed.toString())
          } else {
            results.push = 'skipped'
          }
        } catch (err) {
          logger.error({ err }, '/open-url push failed')
          results.push = 'failed'
        }
      }

      sendJSON(res, 200, { ok: true, url: parsed.toString(), target, results })
    } catch (err) {
      logger.error({ err }, '/open-url error')
      sendJSON(res, 500, { error: 'internal_error' })
    }
    return
  }

  // ── Endpoints PRP-026 (Fase 3 brief master {{AGENT_NAME}}): semantic memory ─────────

  // POST /embed — { text } → { embedding: number[1536], model, dimensions }
  if (req.method === 'POST' && req.url === '/embed') {
    try {
      const body = await readBody(req)
      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch {
        sendJSON(res, 400, { error: 'invalid JSON body' })
        return
      }
      const text = (parsed as { text?: unknown } | null)?.text
      if (typeof text !== 'string' || text.trim().length === 0) {
        sendJSON(res, 400, { error: 'field "text" is required and must be non-empty string' })
        return
      }
      const embedding = await embedText(text)
      sendJSON(res, 200, { embedding, model: 'text-embedding-3-small', dimensions: EMBEDDING_DIMENSIONS })
    } catch (err) {
      if (err instanceof EmbeddingNotConfiguredError) {
        sendJSON(res, 503, { error: 'embeddings provider not configured', detail: 'set OPENAI_API_KEY in agent-server/.env' })
        return
      }
      if (err instanceof EmbeddingError) {
        const status = err.retryable ? 502 : (err.status && err.status >= 400 && err.status < 600 ? err.status : 500)
        sendJSON(res, status, { error: 'upstream embedding failed', retryable: err.retryable, detail: err.message })
        return
      }
      logger.error({ err }, '/embed unexpected error')
      sendJSON(res, 500, { error: 'internal embedding error' })
    }
    return
  }

  // GET /recall?query=...&limit=5 → { memories: MemoryRow[], query, limit }
  if (req.method === 'GET' && req.url?.startsWith('/recall')) {
    try {
      const url = new URL(req.url, `http://localhost:${MC_SERVER_PORT}`)
      const query = url.searchParams.get('query')
      if (!query || query.trim().length === 0) {
        sendJSON(res, 400, { error: 'query parameter is required and must be non-empty' })
        return
      }
      const limit = clampLimit(url.searchParams.get('limit'))
      const memories = await recallMemories(query, { limit })
      sendJSON(res, 200, { memories, query, limit })
    } catch (err) {
      if (err instanceof RecallNotConfiguredError) {
        sendJSON(res, 503, { error: 'recall not configured', detail: err.message })
        return
      }
      if (err instanceof RecallError) {
        sendJSON(res, err.status ?? 500, { error: 'recall failed', detail: err.message })
        return
      }
      logger.error({ err }, '/recall unexpected error')
      sendJSON(res, 500, { error: 'internal recall error' })
    }
    return
  }

  // ── Endpoint PRP-031 (Fase 4 brief master chat-mission-control): voice STT ───

  // POST /transcribe — multipart/form-data { file: <audio blob> } → { text }
  // Fail-soft 503 si GROQ_API_KEY no está sembrado en agent-server/.env.
  if (req.method === 'POST' && req.url === '/transcribe') {
    try {
      const boundary = extractBoundary(req.headers['content-type'])
      const body = await readBodyAsBuffer(req)
      const { files } = parseMultipartBody(body, boundary)
      const audioFile = files.find((f) => f.name === 'file')
      if (!audioFile) {
        sendJSON(res, 400, {
          error: 'missing field',
          detail: 'expected multipart field "file" with audio blob',
        })
        return
      }
      const text = await transcribeAudioBuffer(
        audioFile.data,
        audioFile.filename || 'audio.webm',
        audioFile.contentType,
      )
      // Validar el texto retornado por Whisper antes de devolver al caller
      // (defense-in-depth — un audio adversarial podría inyectar prompt
      // injection en la transcripción).
      const safeText = validateInput(text, 'voice-transcribe')
      sendJSON(res, 200, { text: safeText })
    } catch (err) {
      if (err instanceof MultipartParseError) {
        sendJSON(res, err.status, { error: 'invalid multipart', detail: err.message })
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      // Fail-soft 503 cuando GROQ_API_KEY no está sembrado.
      if (msg.includes('GROQ_API_KEY not configured')) {
        sendJSON(res, 503, {
          error: 'voice STT not configured',
          detail: 'set GROQ_API_KEY in agent-server/.env to enable transcribe',
        })
        return
      }
      logger.error({ err }, '/transcribe error')
      sendJSON(res, 502, { error: 'transcribe failed', detail: msg })
    }
    return
  }

  sendJSON(res, 404, { error: 'Not found' })
}

// ─── Boot ────────────────────────────────────────────────────────────────────

export function startMCServer(): void {
  if (!MC_TOKEN) {
    throw new Error('FATAL: OPENCLAW_GATEWAY_TOKEN is not set; refusing to start HTTP server.')
  }

  httpServer = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      logger.error({ err }, 'server unhandled error')
      try { sendJSON(res, 500, { error: 'Internal server error' }) } catch { /* headers already sent */ }
    })
  })

  httpServer.listen(MC_SERVER_PORT, '127.0.0.1', () => {
    logger.info({ port: MC_SERVER_PORT, origins: ALLOWED_ORIGINS }, 'MC web server listening on 127.0.0.1')
  })
}

export function stopMCServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!httpServer) return resolve()
    httpServer.close(() => {
      logger.info('MC web server closed')
      resolve()
    })
    setTimeout(() => resolve(), 2000)
  })
}
