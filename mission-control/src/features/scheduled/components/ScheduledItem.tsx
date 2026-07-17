'use client'

import { useState } from 'react'
import cronstrue from 'cronstrue'
import { formatDistanceToNow } from 'date-fns'
import { Play, Pause, RotateCcw, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Modal } from '@/core/components/macos/Modal'
import type { ScheduledTask } from '../types'

function humanizeCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { use24HourTimeFormat: false, locale: 'en' })
  } catch {
    return expr
  }
}

function fmtRelativeTs(secs: number | null): string {
  if (!secs) return '—'
  try {
    return formatDistanceToNow(new Date(secs * 1000), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function ScheduledItem({
  task,
  onRunNow,
  onPause,
  onResume,
  onDelete,
  onEdit,
}: {
  task: ScheduledTask
  onRunNow: () => void
  onPause: () => void
  onResume: () => void
  onDelete: () => void
  onEdit: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const paused = task.status === 'paused'

  return (
    <>
      <article className="mc-card rounded-card p-4">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3
                className="truncate text-headline"
                style={{ color: 'var(--label-primary)' }}
              >
                {task.id}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-caption2"
                style={{
                  background: paused ? 'var(--fill-secondary)' : 'rgba(50,215,75,0.15)',
                  color: paused ? 'var(--label-tertiary)' : 'var(--sys-green)',
                }}
              >
                {paused ? 'paused' : 'active'}
              </span>
            </div>
            <p
              className="truncate text-callout"
              style={{ color: 'var(--label-secondary)' }}
            >
              {humanizeCron(task.schedule)}
              <span style={{ color: 'var(--label-tertiary)' }}>{' · '}{task.schedule}</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onRunNow}
              disabled={paused}
              aria-label="Run now"
              className="mc-interactive inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[color:var(--fill-secondary)] disabled:opacity-40"
              style={{ color: 'var(--label-secondary)' }}
            >
              <RotateCcw size={13} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={paused ? onResume : onPause}
              aria-label={paused ? 'Resume' : 'Pause'}
              className="mc-interactive inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[color:var(--fill-secondary)]"
              style={{ color: 'var(--label-secondary)' }}
            >
              {paused ? <Play size={13} strokeWidth={1.8} /> : <Pause size={13} strokeWidth={1.8} />}
            </button>
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit"
              className="mc-interactive inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[color:var(--fill-secondary)]"
              style={{ color: 'var(--label-secondary)' }}
            >
              <Pencil size={13} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              aria-label="Delete"
              className="mc-interactive inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-[color:var(--fill-secondary)] hover:text-[color:var(--sys-red)]"
              style={{ color: 'var(--label-secondary)' }}
            >
              <Trash2 size={13} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <p
          className="mt-3 line-clamp-2 text-callout"
          style={{ color: 'var(--label-secondary)' }}
        >
          {task.prompt}
        </p>

        <footer
          className="mt-3 flex items-center gap-4 text-caption2"
          style={{ color: 'var(--label-tertiary)' }}
        >
          <span>Last run: {fmtRelativeTs(task.last_run)}</span>
          <span>Next: {fmtRelativeTs(task.next_run)}</span>
        </footer>
      </article>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        label="Confirmar borrado"
        role="alertdialog"
        panelMaxWidth="420px"
        panelClassName="p-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{
              background: 'rgba(255,69,58,0.15)',
              color: 'var(--sys-red)',
            }}
          >
            <AlertTriangle size={20} strokeWidth={1.8} />
          </div>
          <h2 className="text-title2" style={{ color: 'var(--label-primary)' }}>
            ¿Borrar este cron job?
          </h2>
          <p
            className="text-callout normal-case"
            style={{ color: 'var(--label-secondary)' }}
          >
            <span style={{ color: 'var(--label-primary)' }}>{task.id}</span> dejará
            de ejecutarse. No se puede deshacer.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="mc-interactive rounded-md px-4 py-2 text-callout"
            style={{
              background: 'var(--fill-secondary)',
              color: 'var(--label-primary)',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmOpen(false)
              onDelete()
            }}
            className="mc-interactive rounded-md px-4 py-2 text-callout text-white"
            style={{ background: 'var(--sys-red)' }}
          >
            Borrar
          </button>
        </div>
      </Modal>
    </>
  )
}
