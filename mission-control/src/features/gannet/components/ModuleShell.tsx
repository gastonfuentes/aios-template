'use client'

/**
 * ModuleShell — common chrome for every demo module.
 *
 * Title, one-line description, a refresh control and a single place for the
 * error banner. Factored out so the thirteen modules stay visually identical in
 * their framing and each module file contains only what makes it different.
 *
 * The error banner is rendered here rather than inside each grid because a
 * module may show several grids fed by the same request; one failure should
 * produce one message, not three.
 */

import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

export function ModuleShell({
  title,
  description,
  loading = false,
  error = null,
  onReload,
  actions,
  children,
}: {
  title: string
  description: string
  loading?: boolean
  error?: string | null
  onReload?: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-5 overflow-auto px-6 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-title2" style={{ color: 'var(--label-primary)' }}>
            {title}
          </h1>
          <p className="text-footnote" style={{ color: 'var(--label-tertiary)' }}>
            {description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              disabled={loading}
              className="mc-interactive inline-flex h-11 items-center gap-2 rounded-control px-4 text-callout"
              style={{ background: 'var(--fill-secondary)', color: 'var(--label-primary)' }}
            >
              <RefreshCw
                size={14}
                strokeWidth={2}
                aria-hidden
                className={loading ? 'animate-spin' : undefined}
              />
              Actualizar
            </button>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-card px-4 py-3 text-callout"
          style={{
            background: 'color-mix(in oklab, var(--sys-red) 12%, transparent)',
            color: 'var(--sys-red)',
          }}
        >
          {error}
        </p>
      )}

      {children}
    </div>
  )
}

/** Titled section wrapper used for the secondary grids inside a module. */
export function ModuleSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <div>
        <h2 className="text-headline" style={{ color: 'var(--label-primary)' }}>
          {title}
        </h2>
        {description && (
          <p className="text-caption1" style={{ color: 'var(--label-tertiary)' }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}
