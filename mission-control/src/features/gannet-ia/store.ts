/**
 * Conversation state for the `/ia` assistant.
 *
 * The store lives outside React so the conversation survives navigating to
 * another module and back — the presenter asks something, walks over to the
 * grid to verify the figure, and returns to a transcript that is still there.
 * Component-local state could not do that: leaving the route unmounts it.
 *
 * It is deliberately in-memory only. This screen runs on a shared kiosk tablet,
 * so a reload starts clean and one prospect never reads the previous one's
 * questions. `reset()` gives the presenter that same fresh start on demand.
 */

import { create } from 'zustand'

export interface Turn {
  readonly id: number
  readonly question: string
  /** `null` while the answer is in flight. */
  readonly answer: string | null
  readonly failed: boolean
}

/** One previous exchange, replayed inline so the next question has a referent. */
export interface ContextTurn {
  readonly question: string
  readonly answer: string
}

/**
 * How many previous exchanges travel with a question.
 *
 * Three covers the chains this demo actually gets ("¿cuántos clientes hay en
 * Catamarca?" → "¿y de esos cuántos están activos?" → "¿y el resto?") while
 * keeping the prompt — and therefore the latency — the same size on turn 2 and
 * on turn 12. Replaying the whole transcript is what made the SDK's own resume
 * grow slower with every turn.
 */
const CONTEXT_TURNS = 3

/**
 * Per-answer ceiling in the replayed context.
 *
 * Demo answers are short by system-prompt design; this only bites on a long
 * enumeration, where the head carries the referent the follow-up needs. Bounding
 * it here keeps the request well inside the service's body limit no matter how
 * long the conversation runs.
 */
const CONTEXT_ANSWER_CHARS = 600

interface IaState {
  readonly turns: readonly Turn[]
  /** Id of the newest started turn; only it may clear `loading`. */
  readonly activeTurnId: number | undefined
  /**
   * Identity of the ongoing conversation, minted here and owned by the client.
   *
   * It is deliberately independent of the SDK session below: the server keys its
   * number-guard on this id, so the guard keeps working across a turn that fell
   * back and produced no session at all. It only changes on `reset()` — a new
   * prospect at the kiosk gets a new id, and with it a clean figure ledger.
   */
  readonly conversationId: string
  /**
   * Session of the ongoing conversation, handed back on each question so a
   * follow-up resolves against what was already said. Only ever set from a
   * grounded answer, so its presence means the history behind it is real.
   */
  readonly sessionId: string | undefined
  readonly loading: boolean
  startTurn: (question: string) => number
  resolveTurn: (id: number, answer: string, sessionId?: string) => void
  failTurn: (id: number, message: string) => void
  reset: () => void
}

let nextId = 1

/**
 * Fresh conversation id.
 *
 * `crypto.randomUUID` needs a secure context; the kiosk is served over the
 * tunnel's TLS or over localhost, so it is there. The fallback exists only so a
 * plain-http origin degrades to a working id instead of throwing at module
 * scope, which would take the whole screen down. Both branches produce a v4
 * shape because the server validates it as a uuid.
 */
function newConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.floor(Math.random() * 256) & (15 >> (Number(c) / 4)))).toString(16),
  )
}

/**
 * The last few completed exchanges, oldest first, ready to travel with the next
 * question. Unanswered and failed turns are skipped: an in-flight turn has no
 * answer yet, and a failed one holds a client-side error message, not something
 * this system ever said. Feeding either back would teach the model a history
 * that never happened.
 */
export function recentContext(turns: readonly Turn[]): readonly ContextTurn[] {
  const done: ContextTurn[] = []
  for (const turn of turns) {
    if (turn.answer === null || turn.failed) continue
    done.push({
      question: turn.question,
      answer:
        turn.answer.length > CONTEXT_ANSWER_CHARS
          ? `${turn.answer.slice(0, CONTEXT_ANSWER_CHARS)}…`
          : turn.answer,
    })
  }
  return done.slice(-CONTEXT_TURNS)
}

export const useIaStore = create<IaState>((set) => ({
  turns: [],
  activeTurnId: undefined,
  conversationId: newConversationId(),
  sessionId: undefined,
  loading: false,

  startTurn: (question) => {
    const id = nextId++
    set((s) => ({
      turns: [...s.turns, { id, question, answer: null, failed: false }],
      activeTurnId: id,
      loading: true,
    }))
    return id
  },

  resolveTurn: (id, answer, sessionId) =>
    set((s) => ({
      turns: s.turns.map((t) => (t.id === id ? { ...t, answer, failed: false } : t)),
      // Sticky: the route omits the session id on any degraded turn — a
      // fallback, a discarded figure, a timeout — and overwriting with that
      // `undefined` used to kill the thread permanently after a single bad turn.
      // The thread itself now travels inline, so this id is only a second line
      // of defence; keeping the last known good one costs nothing and lets the
      // orchestrator resume if a turn ever ships without context.
      sessionId: sessionId ?? s.sessionId,
      // Only the newest turn owns the flag; a straggler must not re-enable the
      // input while a later question is still in flight.
      loading: s.activeTurnId === id ? false : s.loading,
    })),

  failTurn: (id, message) =>
    set((s) => ({
      turns: s.turns.map((t) => (t.id === id ? { ...t, answer: message, failed: true } : t)),
      // A hard failure — the request never came back — is the one case where the
      // session is worth dropping: nothing was answered, so there is nothing to
      // resume against. The conversation id survives, so the figures this server
      // already published stay recognised when the next question works.
      sessionId: undefined,
      loading: s.activeTurnId === id ? false : s.loading,
    })),

  reset: () =>
    set({
      turns: [],
      activeTurnId: undefined,
      // A new conversation is a new figure ledger; reusing the id would let the
      // next prospect's answers restate figures published for the previous one.
      conversationId: newConversationId(),
      sessionId: undefined,
      loading: false,
    }),
}))
