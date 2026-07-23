/**
 * Localhost-only HTTP entry point for the read-only orchestrator.
 *
 * Binds to 127.0.0.1 exclusively — mission-control reaches it over loopback and
 * nothing else can. Two endpoints: `GET /health` for liveness and `POST /ask`
 * for one orchestrated answer. The response reports whether a read-only tool was
 * actually used, so mission-control's number-guard can discard an ungrounded
 * answer and fall back to the deterministic stage-1 builders.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { z } from 'zod'
import { HAS_OAUTH_TOKEN, HOST, PORT } from './config.js'
import { orchestrate, type ContextTurn } from './orchestrator.js'
import { ALL_TOOL_NAMES } from './tools/index.js'

/**
 * Previous exchanges of this conversation, replayed inline.
 *
 * This is what makes a follow-up ("y de esos, ¿cuántos están activos?") resolve
 * against the previous answer, at a cost that does not grow with the thread.
 * Bounded on every axis because it is caller-supplied text that reaches the
 * model: at most three exchanges, each field length-capped, so the worst-case
 * prompt is a known size.
 */
const ContextSchema = z
  .array(
    z.object({
      question: z.string().trim().min(1).max(500),
      answer: z.string().trim().min(1).max(1_200),
    }),
  )
  .max(3)

const QuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  context: ContextSchema.optional(),
  /**
   * Optional SDK session to continue. Bounded and shape-checked like every other
   * input: a caller-supplied session id reaches the SDK, so it is never trusted
   * as free-form text.
   */
  sessionId: z.string().trim().uuid().optional(),
})

interface AskBody {
  readonly answer: string
  readonly toolUsed: boolean
  readonly toolNames: readonly string[]
  readonly sessionId?: string
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

/**
 * Request-body ceiling. A question alone fits in a fraction of this; the room is
 * for the inline context, whose schema-capped worst case (3 × (500 + 1200)
 * chars) plus JSON escaping lands near 8 KB — the previous limit, which would
 * have rejected a long conversation before Zod ever got to bound it.
 */
const MAX_BODY_BYTES = 32_768

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > MAX_BODY_BYTES) throw new Error('payload too large')
    chunks.push(buf)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  return raw === '' ? {} : (JSON.parse(raw) as unknown)
}

async function handleAsk(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let question: string
  let context: readonly ContextTurn[]
  let sessionId: string | undefined
  try {
    const parsed = QuestionSchema.parse(await readBody(req))
    question = parsed.question
    context = parsed.context ?? []
    sessionId = parsed.sessionId
  } catch {
    sendJson(res, 400, { error: 'invalid question' })
    return
  }
  try {
    const result = await orchestrate(question, context, sessionId)
    const body: AskBody = result
    sendJson(res, 200, body)
  } catch (error) {
    // Any SDK/subscription/timeout failure is a hard 503 so the caller falls back.
    // The cause is logged so `journalctl -u gannet-ia` can tell a rate limit or an
    // expired subscription apart from a timeout — from the caller's side they are
    // all the same opaque 503.
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[ask] orchestrator failed: ${reason}`)
    sendJson(res, 503, { error: 'orchestrator unavailable' })
  }
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, hasToken: HAS_OAUTH_TOKEN, tools: ALL_TOOL_NAMES.length })
    return
  }
  if (req.method === 'POST' && req.url === '/ask') {
    void handleAsk(req, res)
    return
  }
  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, HOST, () => {
  process.stdout.write(`gannet-ia listening on http://${HOST}:${PORT} (${ALL_TOOL_NAMES.length} tools)\n`)
})
