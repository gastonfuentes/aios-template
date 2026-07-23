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
 * plus two model round-trips), and it no longer grows with the conversation now
 * that history travels inline instead of through the SDK's resume. This budget
 * sits *above* the service's own 16s so the service always times out first: its
 * abort produces a 503 with a logged reason, while ours produces an opaque
 * `AbortError` that says nothing about what went wrong. Ours is the backstop for
 * a socket that hangs without the service noticing. Overridable via
 * `GANNET_IA_TIMEOUT_MS`.
 */
const ORCHESTRATOR_TIMEOUT_MS = Number(process.env.GANNET_IA_TIMEOUT_MS ?? '18000')

/** One previous exchange, replayed inline so a follow-up has a referent. */
export interface ContextTurn {
  readonly question: string
  readonly answer: string
}

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
 * Asks the orchestrator one question, carrying the previous exchanges inline so
 * a follow-up resolves against them. Returns `null` on any failure, timeout,
 * non-2xx, or malformed body — every one of which routes the caller to the
 * deterministic stage-1 fallback.
 */
export async function askOrchestrator(
  question: string,
  context: readonly ContextTurn[],
  sessionId?: string,
): Promise<OrchestratedAnswer | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ORCHESTRATOR_TIMEOUT_MS)
  try {
    const res = await fetch(ORCHESTRATOR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        ...(context.length > 0 && { context }),
        ...(sessionId !== undefined && { sessionId }),
      }),
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
 * Nouns whose counts are claims about the business, not incidental numbers.
 *
 * The list has to track the vocabulary the demo actually reports on. It used to
 * cover only formatted units, so "5 clientes" stated without a tool behind it
 * read as figure-free and skipped the guard entirely: a single digit never
 * reaches the `\d{2,}` branch, and `clientes` was not a listed noun.
 */
const FIGURE_NOUNS =
  'mil|M|B|%|d[íi]as?|facturas?|veh[íi]culos?|empleados?|unidades?' +
  '|clientes?|faenas?|proyectos?|contactos?|[óo]rdenes?|OT\\b|provincias?' +
  '|art[íi]culos?|contratos?|cotizaciones?|documentos?|equipos?|obras?' +
  '|dep[óo]sitos?|servicios?|personas?|sucursales?|repuestos?'

/** Built once; no `g` flag, so `test` carries no state between calls. */
const FIGURE_PATTERN = new RegExp(
  `\\$\\s?\\d|\\d[\\d.,]*\\s*(?:${FIGURE_NOUNS})|\\d{2,}`,
  'i',
)

/**
 * True when the text states a figure — currency, a grouped number, a percentage,
 * or a count of any noun this demo reports on. Used by the number-guard: such a
 * claim is only trustworthy if a tool was actually called to produce it.
 */
export function containsFigure(text: string): boolean {
  return FIGURE_PATTERN.test(text)
}
