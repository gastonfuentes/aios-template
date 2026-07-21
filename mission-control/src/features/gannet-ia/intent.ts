/**
 * Keyword-based intent matching for the AI screen (`/ia`).
 *
 * Stage 1 has no model, so a free-text question is routed to one of exactly
 * three curated answers by matching normalized keywords. Anything that does not
 * match confidently is a miss — the route then returns the demo's flat refusal
 * rather than improvising, which is the correct behaviour per the demo spec.
 *
 * Matching is deterministic and order-sensitive: the two receivables intents
 * overlap on words like "deuda", so the more specific "call list" intent is
 * evaluated before the "top debtor" intent and wins on its distinctive verbs
 * ("cobrar", "llamo", "primero", "esta semana").
 */

/** The three supported intents; a miss is represented by `null`. */
export type IntentKey = 'flota-no-apto' | 'cobranzas-priorizar' | 'cobranzas-top'

/** Which view an answer is grounded in, surfaced to the client for context. */
export type AnswerSource = 'flota' | 'cobranzas' | 'none'

interface IntentDef {
  readonly key: IntentKey
  readonly source: AnswerSource
  /** Any one of these normalized substrings present is enough to match. */
  readonly keywords: readonly string[]
}

/**
 * Order matters. `cobranzas-priorizar` precedes `cobranzas-top` so a question
 * that carries both a debt word and a "who do I call" verb routes to the call
 * list, not the single-debtor answer.
 */
const INTENTS: readonly IntentDef[] = [
  {
    key: 'flota-no-apto',
    source: 'flota',
    keywords: [
      'circular',
      'no apto',
      'condiciones de circular',
      'vehiculo',
      'vehiculos',
      'flota',
      'vtv',
      'camion',
    ],
  },
  {
    key: 'cobranzas-priorizar',
    source: 'cobranzas',
    keywords: [
      'llamo',
      'llamar',
      'primero',
      'cobrar',
      'priorizar',
      'esta semana',
      'mil millones',
      '5 mil',
      '5000',
    ],
  },
  {
    key: 'cobranzas-top',
    source: 'cobranzas',
    keywords: ['debe mas', 'me debe', 'deuda', 'vencida', 'moroso', 'desde cuando', 'atrasado'],
  },
]

/**
 * Lowercases and strips diacritics so "vehículo" matches "vehiculo" and the
 * keyword tables can stay plain ASCII.
 */
function normalize(question: string): string {
  return question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export interface IntentMatch {
  readonly key: IntentKey
  readonly source: AnswerSource
}

/**
 * Scores the question against each intent by counting matched keywords and
 * returns the best match, or `null` when nothing matches. Ties break toward the
 * earlier (more specific) intent, which is why `INTENTS` order is load-bearing.
 */
export function matchIntent(question: string): IntentMatch | null {
  const text = normalize(question)

  let best: IntentDef | null = null
  let bestScore = 0

  for (const intent of INTENTS) {
    const score = intent.keywords.reduce(
      (count, keyword) => (text.includes(keyword) ? count + 1 : count),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      best = intent
    }
  }

  if (best === null || bestScore === 0) return null
  return { key: best.key, source: best.source }
}
