'use client'

/**
 * IaModule — the conversational query screen (`/ia`).
 *
 * A visitor types a question about the business and gets an answer grounded in
 * the real seeded data. Stage 1 answers from deterministic templates over the
 * `gd_*` views (no model), so the numbers are identical to what `/flota` and
 * `/facturacion` display.
 *
 * Presented on a tablet at the stand: touch only, viewport 1024–1280 wide. Every
 * tap target — the example chips, the send button — is at least 44px, and there
 * are no hover-only affordances. The layout stays calm and legible from a
 * projector.
 */

import { useCallback, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import type { AskResponse } from '@/app/api/gannet/ask/route'

/** The three curated questions, offered as tappable chips. */
const EXAMPLES: readonly string[] = [
  '¿Qué vehículos no están en condiciones de circular y por qué?',
  '¿Qué cliente me debe más plata vencida y desde cuándo?',
  'Si tengo que cobrar 5 mil millones esta semana, ¿a quién llamo primero?',
]

const GENERIC_ERROR = 'No se pudo consultar en este momento.'
const TIMEOUT_ERROR = 'La consulta tardó demasiado. Probá de nuevo.'

/**
 * Client-side ceiling for the whole round-trip. The route's own budget is 20s
 * (orchestrator) plus an 8s deterministic fallback, so 25s lets the server win
 * the race whenever it can still answer and only fires when the connection
 * itself has stalled. Without it a stalled mobile connection never rejects and
 * the waiting state stays up forever.
 */
const REQUEST_TIMEOUT_MS = 25_000

export function IaModule() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ask = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length === 0 || loading) return

    setLoading(true)
    setAnswer(null)
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch('/api/gannet/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed }),
        cache: 'no-store',
        signal: controller.signal,
      })
      const data = (await res.json()) as AskResponse
      setAnswer(data.answer ?? GENERIC_ERROR)
    } catch (error) {
      const aborted = error instanceof DOMException && error.name === 'AbortError'
      setAnswer(aborted ? TIMEOUT_ERROR : GENERIC_ERROR)
    } finally {
      clearTimeout(timer)
      setLoading(false)
    }
    // `loading` is read to guard re-entry; it is a stable setter dependency.
  }, [loading])

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      void ask(question)
    },
    [ask, question],
  )

  const onExample = useCallback(
    (example: string) => {
      setQuestion(example)
      void ask(example)
      inputRef.current?.blur()
    },
    [ask],
  )

  return (
    <ModuleShell
      title="Asistente Gannet"
      description="Consultá la información de la empresa en lenguaje natural. Las respuestas salen de los datos reales del sistema."
    >
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-caption1" style={{ color: 'var(--label-secondary)' }}>
          Preguntas de ejemplo
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onExample(example)}
              disabled={loading}
              className="mc-interactive-soft flex min-h-[64px] items-center gap-2 rounded-card px-4 py-3 text-left text-callout mc-card"
              style={{ color: 'var(--label-primary)' }}
            >
              <Sparkles
                size={16}
                strokeWidth={2}
                aria-hidden
                style={{ color: 'var(--sys-blue)' }}
                className="shrink-0"
              />
              <span className="min-w-0">{example}</span>
            </button>
          ))}
        </div>
      </section>

      <form onSubmit={onSubmit} className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Escribí tu pregunta…"
          enterKeyHint="send"
          maxLength={500}
          disabled={loading}
          className="mc-card min-h-[52px] flex-1 rounded-control px-4 text-body outline-none"
          style={{ color: 'var(--label-primary)', background: 'var(--fill-secondary)' }}
        />
        <button
          type="submit"
          disabled={loading || question.trim().length === 0}
          className="mc-interactive inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-control px-5 text-callout"
          style={{ background: 'var(--sys-blue)', color: '#fff' }}
        >
          <Send size={16} strokeWidth={2} aria-hidden className={loading ? 'animate-pulse' : undefined} />
          <span>Consultar</span>
        </button>
      </form>

      <section
        className="mc-card rounded-card p-5"
        aria-live="polite"
        style={{ minHeight: '180px' }}
      >
        {loading ? (
          <div className="flex items-center gap-3" role="status">
            <span className="inline-flex gap-1.5" aria-hidden>
              {[0, 160, 320].map((delay) => (
                <span
                  key={delay}
                  className="h-2.5 w-2.5 animate-bounce rounded-full"
                  style={{ background: 'var(--accent)', animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
            <p className="text-callout" style={{ color: 'var(--label-secondary)' }}>
              Consultando los datos del sistema…
            </p>
          </div>
        ) : answer === null ? (
          <p className="text-callout" style={{ color: 'var(--label-tertiary)' }}>
            Tocá una pregunta de ejemplo o escribí la tuya para ver la respuesta.
          </p>
        ) : (
          <p
            className="whitespace-pre-line text-body"
            style={{ color: 'var(--label-primary)' }}
          >
            {answer}
          </p>
        )}
      </section>
    </ModuleShell>
  )
}
