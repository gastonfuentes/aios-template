'use client'

/**
 * Shared chart chrome: card frame, legend, tooltip and axis helpers.
 *
 * Factored out so the four charts differ only in what they plot. Two rules are
 * enforced here rather than repeated in each chart:
 *
 * - Text never wears the series color. Values, labels, legend entries and axis
 *   ticks resolve to `--label-*`; identity comes from the colored swatch beside
 *   the text. Recharts' own `<Legend>` paints its item text with the series
 *   fill, which is why this file ships an HTML legend instead.
 * - Every chart gets a hover layer. The tooltip is the default, not an option.
 */

import type { ReactElement, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

/** Card frame matching the `mc-card` look of the surrounding modules. */
export function ChartCard({
  title,
  description,
  legend,
  height,
  children,
}: {
  title: string
  description?: string
  legend?: ReactNode
  height: number
  children: ReactElement
}) {
  return (
    <section className="mc-card flex min-w-0 flex-col gap-3 rounded-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-headline" style={{ color: 'var(--label-primary)' }}>
            {title}
          </h3>
          {description && (
            <p className="text-caption1" style={{ color: 'var(--label-tertiary)' }}>
              {description}
            </p>
          )}
        </div>
        {legend}
      </header>
      {/* ResponsiveContainer keeps wide charts inside the column so the page
          never scrolls horizontally. */}
      <div className="min-w-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  )
}

/** Legend entry: colored swatch plus neutral-ink label. */
export function ChartLegend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <ul className="flex shrink-0 flex-wrap items-center gap-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-caption2" style={{ color: 'var(--label-secondary)' }}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Minimal shape of a Recharts tooltip entry. Declared locally rather than
 * imported so the tooltip stays decoupled from Recharts' internal generics —
 * and so nothing here needs `any`.
 */
export type TooltipEntry = {
  readonly name?: unknown
  readonly value?: unknown
  readonly color?: string
  readonly dataKey?: unknown
}

export function ChartTooltip({
  active,
  label,
  payload,
  formatValue,
}: {
  active?: boolean
  label?: unknown
  payload?: readonly TooltipEntry[]
  formatValue: (value: number | null) => string
}) {
  if (active !== true || payload === undefined || payload.length === 0) return null

  return (
    <div
      className="mc-card rounded-card px-3 py-2 text-caption2"
      style={{ border: '1px solid var(--separator)' }}
    >
      {label !== undefined && label !== null && (
        <p className="mb-1" style={{ color: 'var(--label-primary)' }}>
          {String(label)}
        </p>
      )}
      {payload.map((entry, index) => (
        <p
          key={`${String(entry.dataKey ?? entry.name ?? index)}`}
          className="flex items-center gap-1.5"
          style={{ color: 'var(--label-secondary)' }}
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: entry.color ?? 'var(--label-tertiary)' }}
          />
          {entry.name !== undefined && <span>{String(entry.name)}</span>}
          <span className="tabular-nums" style={{ color: 'var(--label-primary)' }}>
            {formatValue(toPlainNumber(entry.value))}
          </span>
        </p>
      ))}
    </div>
  )
}

/** Narrows an unknown Recharts value to a number, or null when it is not one. */
export function toPlainNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Shared axis tick typography. Axis text is ink, never a series color. */
export function axisTick(color: string) {
  return { fill: color, fontSize: 11 } as const
}

/** Hairline, solid, recessive — never dashed. */
export function axisLine(color: string) {
  return { stroke: color, strokeWidth: 1 } as const
}

const NICE_STEPS = [1, 2, 2.5, 5, 10] as const

/**
 * Ticks at clean rounded values covering `[0, max]`.
 *
 * Recharts' own tick picker lands on values like 743.219.412, which read as
 * noise on a currency axis. This snaps the step to 1/2/2.5/5 x 10^n so every
 * tick is a round figure.
 */
export function niceTicks(max: number, count = 5): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0]
  const rough = max / (count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step =
    (NICE_STEPS.find((candidate) => candidate * magnitude >= rough) ?? 10) * magnitude
  const ticks: number[] = []
  for (let value = 0; value <= max + step / 2; value += step) ticks.push(value)
  return ticks
}

/** Upper bound of a nice-tick scale, so bars and lines end on a round gridline. */
export function niceMax(max: number, count = 5): number {
  const ticks = niceTicks(max, count)
  return ticks[ticks.length - 1] ?? 0
}
