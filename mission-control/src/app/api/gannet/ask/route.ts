/**
 * POST /api/gannet/ask — AI answers for the kiosk `/ia` screen.
 *
 * STAGE 2: an isolated, read-only orchestrator service (localhost only) puts a
 * language model in front of the deterministic stage-1 answers, so questions can
 * go beyond the three scripted intents while every figure still comes from a
 * tool that queried the real `gd_*` views. The model never touches the
 * filesystem, a shell, or a write path.
 *
 * Three layers keep the demo honest and unbreakable on stage:
 *   1. Orchestrator first, with an 8s timeout.
 *   2. A number-guard: if the model's text states a figure but reports that NO
 *      tool was used that turn, the answer is ungrounded and is discarded.
 *   3. Fallback to the stage-1 deterministic builders for the three scripted
 *      intents, and a flat "No tengo ese dato" otherwise. If the model is down,
 *      timed out, or ungrounded, the demo degrades exactly to stage 1 — never
 *      worse.
 *
 * The route stays public (kiosk, no session) but read-only and narrow: it
 * accepts a bounded question, never SQL; it never writes, shells out or touches
 * the filesystem. A per-IP rate limit and the overall timeout keep it calm.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchCobranzasAging, fetchFlotaNoApto } from '@/features/gannet-ia/queries'
import {
  answerCollectionPlan,
  answerFlotaNoApto,
  answerTopDebtor,
} from '@/features/gannet-ia/answer'
import { matchIntent, type AnswerSource, type IntentMatch } from '@/features/gannet-ia/intent'
import { askOrchestrator, containsFigure } from '@/features/gannet-ia/orchestrator-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The demo's standard refusal. Refusing is correct; improvising is not. */
const REFUSAL = 'No tengo ese dato'
/** Soft failure shown when the database cannot be reached in time. */
const SOFT_ERROR = 'No pude consultar ese dato en este momento.'

/** Budget for the deterministic fallback's database round-trip. */
const FALLBACK_TIMEOUT_MS = 8_000

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

const QuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  sessionId: z.string().trim().uuid().optional(),
})

export interface AskResponse {
  readonly answer: string
  readonly source: AnswerSource
  /**
   * Present only when the answer was grounded. The client stores it and sends
   * it back on the next question; because a session id is never handed out for
   * an ungrounded turn, holding one implies the conversation so far was real.
   */
  readonly sessionId?: string
}

const hits = new Map<string, number[]>()

/**
 * Figures published in the last grounded answer of each conversation.
 *
 * A follow-up may legitimately restate a number from the previous turn without
 * calling a tool again. Trusting the mere presence of a session id to allow that
 * would be wrong twice over: a grounded history says nothing about the current
 * turn, and the id is client-supplied, so any well-formed uuid would do. Instead
 * the server remembers what it actually published and lets an untooled figure
 * through only when it was already published for that same session.
 */
const publishedFigures = new Map<string, ReadonlySet<string>>()

/**
 * Canonical numeric value of every figure in the text.
 *
 * es-AR groups thousands with `.` and marks decimals with `,`, so the two
 * separators cannot be stripped alike: doing that collapses `72,3` and `7,23`
 * onto the same key and would let a fabricated figure pass as one already
 * published. Only thousands separators are removed; the decimal comma becomes a
 * point and the result is compared as a number.
 */
function figuresOf(text: string): ReadonlySet<string> {
  const found = text.match(/\d[\d.,]*/g) ?? []
  const out = new Set<string>()
  for (const raw of found) {
    const canonical = raw
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(/,(?=\d{3}(\D|$))/g, '')
      .replace(',', '.')
      .replace(/[.,]+$/, '')
    const value = Number(canonical)
    // Fail closed. A token this parser cannot resolve is kept verbatim rather
    // than dropped: a dropped figure is neither remembered nor checked, so it
    // could never block anything, which is exactly how a guard gets bypassed.
    out.add(Number.isFinite(value) ? String(value) : raw)
  }
  return out
}

/** Sessions whose figures are retained; the kiosk runs all day unattended. */
const MAX_TRACKED_SESSIONS = 200

/** Figures retained per conversation before the oldest are forgotten. */
const MAX_FIGURES_PER_SESSION = 400

function rememberFigures(sessionId: string | undefined, answer: string): void {
  if (sessionId === undefined) return
  // Bounded: evict the oldest entry rather than growing without limit over a
  // full day of stand traffic. Map iteration order is insertion order.
  if (!publishedFigures.has(sessionId) && publishedFigures.size >= MAX_TRACKED_SESSIONS) {
    const oldest = publishedFigures.keys().next()
    if (!oldest.done) publishedFigures.delete(oldest.value)
  }
  // Accumulate across the conversation instead of replacing. Every turn is a
  // thing this server published, and a later question may restate a figure from
  // several turns back; overwriting would forget it and reject the restatement.
  const previous = publishedFigures.get(sessionId)
  const merged = new Set(previous ?? [])
  for (const figure of figuresOf(answer)) {
    if (merged.size >= MAX_FIGURES_PER_SESSION) break
    merged.add(figure)
  }
  // Delete before setting so recency refreshes here too. `Map.set` on a key that
  // already exists updates the value without moving its position, so writing
  // alone would leave an actively used session pinned at its original slot and
  // still first in line for eviction.
  publishedFigures.delete(sessionId)
  publishedFigures.set(sessionId, merged)
}

/** True when every figure in `answer` was already published for this session. */
function onlyRestatesKnownFigures(sessionId: string, answer: string): boolean {
  const known = publishedFigures.get(sessionId)
  if (known === undefined) return false
  // Re-insert so eviction is least-recently-used: a conversation still in use
  // must not be dropped just because it happened to start first.
  publishedFigures.delete(sessionId)
  publishedFigures.set(sessionId, known)
  for (const figure of figuresOf(answer)) {
    if (!known.has(figure)) return false
  }
  return true
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((ts) => now - ts < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > RATE_LIMIT
}

/**
 * The public preview sits behind Cloudflare Tunnel, which sets `cf-connecting-ip`
 * itself and only *appends* to `x-forwarded-for`. Keying the limiter on the first
 * XFF element would therefore key it on a value the caller controls, letting any
 * visitor rotate a fake address per request and bypass the cap entirely.
 */
function clientIp(req: Request): string {
  const cloudflare = req.headers.get('cf-connecting-ip')
  if (cloudflare !== null && cloudflare.length > 0) return cloudflare.trim()
  // Direct/local access only — no proxy in front, so the socket headers are honest.
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function reply(
  answer: string,
  source: AnswerSource,
  status = 200,
  sessionId?: string,
): NextResponse<AskResponse> {
  return NextResponse.json(
    sessionId === undefined ? { answer, source } : { answer, source, sessionId },
    { status },
  )
}

/**
 * Stage-1 deterministic answer for the three scripted intents. Reused verbatim
 * as the fallback: its numbers are byte-identical to the module screens.
 */
async function deterministicAnswer(intent: IntentMatch): Promise<AskResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS)
  try {
    switch (intent.key) {
      case 'flota-no-apto': {
        const rows = await fetchFlotaNoApto(controller.signal)
        return { answer: answerFlotaNoApto(rows), source: 'flota' }
      }
      case 'cobranzas-top': {
        const rows = await fetchCobranzasAging(controller.signal)
        return { answer: answerTopDebtor(rows), source: 'cobranzas' }
      }
      case 'cobranzas-priorizar': {
        const rows = await fetchCobranzasAging(controller.signal)
        return { answer: answerCollectionPlan(rows), source: 'cobranzas' }
      }
    }
  } catch {
    return { answer: SOFT_ERROR, source: intent.source }
  } finally {
    clearTimeout(timeout)
  }
}

/** Fallback path: scripted intent → deterministic builder; otherwise refusal. */
async function fallback(question: string): Promise<AskResponse> {
  const intent = matchIntent(question)
  if (intent === null) return { answer: REFUSAL, source: 'none' }
  return deterministicAnswer(intent)
}

export async function POST(req: Request): Promise<Response> {
  if (isRateLimited(clientIp(req))) {
    return reply('Demasiadas consultas seguidas. Probá de nuevo en un momento.', 'none', 429)
  }

  let question: string
  let sessionId: string | undefined
  try {
    const parsed = QuestionSchema.parse(await req.json())
    question = parsed.question
    sessionId = parsed.sessionId
  } catch {
    return reply('Escribí una pregunta para consultar.', 'none', 400)
  }

  // 1) Orchestrator first. 2) Number-guard: discard a figure with no tool behind
  // it. Any miss falls through to the stage-1 deterministic path.
  const orchestrated = await askOrchestrator(question, sessionId)
  if (orchestrated !== null) {
    // Grounded when a tool ran, when there is no figure to get wrong, or when
    // every figure merely restates one this server already published for this
    // same session. A brand-new untooled figure is still discarded, which is the
    // whole point of the guard.
    const grounded =
      orchestrated.toolUsed ||
      !containsFigure(orchestrated.answer) ||
      (sessionId !== undefined && onlyRestatesKnownFigures(sessionId, orchestrated.answer))
    if (grounded) {
      if (orchestrated.toolUsed) rememberFigures(orchestrated.sessionId, orchestrated.answer)
      return reply(orchestrated.answer, 'none', 200, orchestrated.sessionId)
    }
  }

  const fell = await fallback(question)
  return reply(fell.answer, fell.source)
}
