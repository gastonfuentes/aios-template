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
})

export interface AskResponse {
  readonly answer: string
  readonly source: AnswerSource
}

const hits = new Map<string, number[]>()

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

function reply(answer: string, source: AnswerSource, status = 200): NextResponse<AskResponse> {
  return NextResponse.json({ answer, source }, { status })
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
  try {
    question = QuestionSchema.parse(await req.json()).question
  } catch {
    return reply('Escribí una pregunta para consultar.', 'none', 400)
  }

  // 1) Orchestrator first. 2) Number-guard: discard a figure with no tool behind
  // it. Any miss falls through to the stage-1 deterministic path.
  const orchestrated = await askOrchestrator(question)
  if (orchestrated !== null) {
    const grounded = orchestrated.toolUsed || !containsFigure(orchestrated.answer)
    if (grounded) return reply(orchestrated.answer, 'none')
  }

  const fell = await fallback(question)
  return reply(fell.answer, fell.source)
}
