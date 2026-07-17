'use client'

import { useMemo, useState } from 'react'
import cronstrue from 'cronstrue'
import { Modal } from '@/core/components/macos/Modal'
import type { ScheduledTask } from '../types'

type Mode = 'create' | 'edit'

function previewCron(expr: string): { ok: true; text: string } | { ok: false; error: string } {
  if (!expr.trim()) return { ok: false, error: 'Empty' }
  try {
    return { ok: true, text: cronstrue.toString(expr, { use24HourTimeFormat: false }) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * PRP-034: el state inicial se lee desde props en useState initializer (corre
 * una vez al mount). Para que el form se "resetee" cuando el modal se abre
 * con un task distinto, el padre pasa `key={initial?.id ?? 'new'}` que fuerza
 * remount. Patrón canónico Praxis (PRP-020) — evita la regla stricter
 * `react-hooks/set-state-in-effect`.
 */
export function ScheduledFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: Mode
  initial?: ScheduledTask | null
  onClose: () => void
  onSubmit: (input: { id: string; prompt: string; schedule: string }) => Promise<{
    ok: boolean
    error?: string
  }>
}) {
  const [id, setId] = useState(() =>
    mode === 'edit' && initial ? initial.id : ''
  )
  const [prompt, setPrompt] = useState(() =>
    mode === 'edit' && initial ? initial.prompt : ''
  )
  const [schedule, setSchedule] = useState(() =>
    mode === 'edit' && initial ? initial.schedule : '0 9 * * 1'
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const preview = useMemo(() => previewCron(schedule), [schedule])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!preview.ok) {
      setError(`Cron inválido: ${preview.error}`)
      return
    }
    if (!id.trim() || !prompt.trim()) {
      setError('id y prompt son requeridos')
      return
    }
    setBusy(true)
    setError(null)
    const result = await onSubmit({ id: id.trim(), prompt: prompt.trim(), schedule: schedule.trim() })
    setBusy(false)
    if (result.ok) {
      onClose()
    } else {
      setError(result.error ?? 'Error desconocido')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label={mode === 'create' ? 'Crear cron job' : 'Editar cron job'}
      panelMaxWidth="520px"
      panelClassName="p-6"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <header>
          <h2 className="text-title2" style={{ color: 'var(--label-primary)' }}>
            {mode === 'create' ? 'Nuevo cron job' : `Editar ${initial?.id ?? ''}`}
          </h2>
          <p
            className="mt-1 text-callout"
            style={{ color: 'var(--label-tertiary)' }}
          >
            El daemon ejecuta el prompt según el schedule en TZ del operador.
          </p>
        </header>

        <Field label="ID">
          <input
            type="text"
            value={id}
            disabled={mode === 'edit'}
            onChange={(e) => setId(e.target.value)}
            placeholder="ej. daily-briefing-7am"
            className="w-full rounded-md px-3 py-2 text-body"
            style={{
              background: 'var(--fill-secondary)',
              color: 'var(--label-primary)',
              border: '1px solid var(--separator)',
            }}
          />
        </Field>

        <Field label="Schedule (cron)">
          <input
            type="text"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="0 9 * * 1"
            className="w-full rounded-md px-3 py-2 font-mono text-body"
            style={{
              background: 'var(--fill-secondary)',
              color: 'var(--label-primary)',
              border: '1px solid var(--separator)',
            }}
          />
          <p
            className="mt-1 text-caption2"
            style={{
              color: preview.ok ? 'var(--sys-green)' : 'var(--sys-red)',
            }}
          >
            {preview.ok ? `→ ${preview.text}` : `× ${preview.error}`}
          </p>
        </Field>

        <Field label="Prompt">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Lo que el agente debe hacer cada vez que se dispara"
            rows={4}
            className="w-full rounded-md px-3 py-2 text-body"
            style={{
              background: 'var(--fill-secondary)',
              color: 'var(--label-primary)',
              border: '1px solid var(--separator)',
            }}
          />
        </Field>

        {error && (
          <p className="text-callout" style={{ color: 'var(--sys-red)' }} role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="mc-interactive rounded-md px-4 py-2 text-callout"
            style={{
              background: 'var(--fill-secondary)',
              color: 'var(--label-primary)',
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy || !preview.ok}
            className="mc-interactive rounded-md px-4 py-2 text-callout text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {busy ? 'Guardando…' : mode === 'create' ? 'Crear' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="text-caption2"
        style={{ color: 'var(--label-secondary)' }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}
