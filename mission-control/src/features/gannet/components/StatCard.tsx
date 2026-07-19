'use client'

/**
 * StatCard — single headline figure with a label and an optional hint.
 *
 * The building block of the executive dashboard KPI grid and of the summary
 * strips at the top of each module. Deliberately dumb: it takes an already
 * formatted string, so the caller decides currency, compaction and locale.
 */

import type { ReactNode } from 'react'
import { TONE_COLOR, type Tone } from '../tone'

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  loading = false,
}: {
  label: string
  value: string
  hint?: string
  tone?: Tone
  icon?: ReactNode
  loading?: boolean
}) {
  const color = TONE_COLOR[tone]
  const isPlaceholder = loading
  return (
    <article
      className="mc-card flex flex-col gap-1.5 rounded-card p-4"
      style={{ borderTop: `2px solid ${color}` }}
    >
      <header className="flex items-center gap-1.5">
        {icon && (
          <span aria-hidden style={{ color }} className="inline-flex">
            {icon}
          </span>
        )}
        <h3 className="text-caption1" style={{ color: 'var(--label-secondary)' }}>
          {label}
        </h3>
      </header>
      <p
        className="text-title2 tabular-nums"
        style={{ color: isPlaceholder ? 'var(--label-tertiary)' : 'var(--label-primary)' }}
      >
        {isPlaceholder ? '—' : value}
      </p>
      {hint && (
        <p className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {isPlaceholder ? '' : hint}
        </p>
      )}
    </article>
  )
}

/** Responsive grid wrapper for a row of stat cards. */
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</section>
  )
}
