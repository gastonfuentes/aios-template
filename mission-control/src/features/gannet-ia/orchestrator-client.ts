import 'server-only'

/**
 * Client for the localhost read-only orchestrator (`gannet-ia.service`).
 *
 * STAGE 2 wires a real language model in front of the deterministic stage-1
 * answers. The model runs in a separate, isolated Node service bound to
 * `127.0.0.1` that can only read the `gd_*` views through curated tools — it has
 * no filesystem, shell or write access. This module is the only bridge to it.
 *
 * The contract is deliberately thin: send a question, get back an answer plus
 * whether a read-only tool was actually used to produce it. That flag powers the
 * route's number-guard: a currency/number in the text with no tool behind it is
 * ungrounded and must be discarded in favour of the deterministic fallback. Any
 * failure, timeout or non-2xx yields `null` so the caller falls back cleanly —
 * the demo is never worse than stage 1, even if the model is completely down.
 */

/** Localhost endpoint. Overridable for a non-default port, never public. */
const ORCHESTRATOR_URL = process.env.GANNET_IA_URL ?? 'http://127.0.0.1:3131/ask'

/**
 * Hard ceiling for the orchestrated round-trip; the request falls back past it.
 *
 * Measured end-to-end latency for a tool + narration turn is ~9–11s (CLI spawn
 * plus two model round-trips), so an 8s cutoff would fall back on almost every
 * off-script question and strand stage 2. 13s comfortably fits a warm turn while
 * still bounding a hung request; the service's own internal budget (20s) is the
 * backstop. Overridable via `GANNET_IA_TIMEOUT_MS`.
 */
const ORCHESTRATOR_TIMEOUT_MS = Number(process.env.GANNET_IA_TIMEOUT_MS ?? '13000')

export interface OrchestratedAnswer {
  readonly answer: string
  readonly toolUsed: boolean
  /** SDK session for this turn; hand it back to continue the conversation. */
  readonly sessionId?: string
}

interface RawResponse {
  readonly answer?: unknown
  readonly toolUsed?: unknown
  readonly sessionId?: unknown
}

/**
 * Asks the orchestrator one question. Returns `null` on any failure, timeout,
 * non-2xx, or malformed body — every one of which routes the caller to the
 * deterministic stage-1 fallback.
 */
export async function askOrchestrator(
  question: string,
  sessionId?: string,
): Promise<OrchestratedAnswer | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS)
  try {
    const res = await fetch(ORCHESTRATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionId === undefined ? { question } : { question, sessionId }),
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) return null
    const body = (await res.json()) as RawResponse
    if (typeof body.answer !== 'string' || typeof body.toolUsed !== 'boolean') return null
    const answer = body.answer.trim()
    if (answer.length === 0) return null
    const session = typeof body.sessionId === 'string' && body.sessionId.length > 0
      ? body.sessionId
      : undefined
    return { answer, toolUsed: body.toolUsed, ...(session !== undefined && { sessionId: session }) }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * True when the text states a figure — currency, a grouped number, a percentage,
 * or a day/quantity count. Used by the number-guard: such a claim is only
 * trustworthy if a tool was actually called to produce it.
 */
export function containsFigure(text: string): boolean {
  return /\$\s?\d|\d[\d.,]*\s*(?:mil|M|B|%|d[íi]as?|facturas?|veh[íi]culos?|empleados?|unidades?)|\d{2,}/i.test(
    text,
  )
}
