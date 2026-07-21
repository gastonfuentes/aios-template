'use client'

/**
 * The one hero figure on the executive dashboard: overdue receivables.
 *
 * Exactly one per view, by design. A board with three 56px numbers has no
 * headline — the presenter points at this one and the room follows. Everything
 * below it (the KPI band, the charts) is supporting evidence.
 *
 * Laid out as a horizontal banner rather than a stacked block. The dashboard is
 * presented on a tablet in landscape (1024x768), where the opening screen has to
 * carry the headline, the commercial KPIs *and* the first chart above the fold.
 * A full-height hero spent a quarter of that budget on a single number; the
 * banner spends about ninety pixels and reads just as loudly, because the figure
 * still has no competition on its row.
 *
 * Set in system sans with proportional figures. `tabular-nums` is for columns of
 * numbers that must align vertically; on a standalone display figure it opens
 * ugly gaps around the narrow glyphs.
 */

import { AlertTriangle } from 'lucide-react'

export function HeroFigure({
  label,
  value,
  hint,
  detail,
  loading = false,
}: {
  label: string
  value: string
  /** Short reading of the figure, shown beside it. */
  hint?: string
  /** Exact amount or secondary precision, shown under the hint. */
  detail?: string
  loading?: boolean
}) {
  return (
    <section
      className="mc-card flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-card px-5 py-3.5"
      style={{ borderTop: '2px solid var(--sys-red)' }}
    >
      <div className="min-w-0">
        <header className="flex items-center gap-1.5">
          <span aria-hidden style={{ color: 'var(--sys-red)' }} className="inline-flex">
            <AlertTriangle size={14} strokeWidth={2} />
          </span>
          <h2 className="text-caption1" style={{ color: 'var(--label-secondary)' }}>
            {label}
          </h2>
        </header>
        <p
          style={{
            fontFamily:
              'ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
            fontSize: '2.5rem',
            lineHeight: 1.1,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'proportional-nums',
            color: loading ? 'var(--label-tertiary)' : 'var(--label-primary)',
          }}
        >
          {loading ? '—' : value}
        </p>
      </div>

      {(hint ?? detail) !== undefined && !loading && (
        <div className="min-w-0 pb-1 sm:text-right">
          {hint && (
            <p className="text-footnote" style={{ color: 'var(--label-secondary)' }}>
              {hint}
            </p>
          )}
          {detail && (
            <p className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
              {detail}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
