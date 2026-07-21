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

interface IaState {
  readonly turns: readonly Turn[]
  /** Id of the newest started turn; only it may clear `loading`. */
  readonly activeTurnId: number | undefined
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

export const useIaStore = create<IaState>((set) => ({
  turns: [],
  activeTurnId: undefined,
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
      // The route omits the session id exactly when it fell back, which is what
      // happens once a resume fails. Keeping the old id would make every later
      // turn re-send a session the orchestrator has already rejected, degrading
      // the screen for the rest of the conversation with nothing shown to the
      // presenter. Dropping it starts a fresh thread on the next question.
      sessionId: sessionId,
      // Only the newest turn owns the flag; a straggler must not re-enable the
      // input while a later question is still in flight.
      loading: s.activeTurnId === id ? false : s.loading,
    })),

  failTurn: (id, message) =>
    set((s) => ({
      turns: s.turns.map((t) => (t.id === id ? { ...t, answer: message, failed: true } : t)),
      sessionId: undefined,
      loading: s.activeTurnId === id ? false : s.loading,
    })),

  reset: () => set({ turns: [], activeTurnId: undefined, sessionId: undefined, loading: false }),
}))
