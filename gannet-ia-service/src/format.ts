/**
 * Formatters replicated byte-for-byte from mission-control's
 * `features/gannet/format.ts`.
 *
 * The whole point of the demo AI is that the figures it narrates are identical
 * to what the module screens display. The screens format through those shared
 * functions; this service is a separate process and cannot import them, so the
 * logic is copied verbatim. If the module formatters change, change these too.
 *
 * All locales are `es-AR`. PostgREST serializes `numeric` as strings to preserve
 * precision, so every numeric formatter coerces `string | number | null`.
 */

export const EMPTY = '—'

export type Numeric = number | string | null | undefined

/** Coerces a PostgREST numeric (string or number) to a number, or null. */
export function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const integerFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })

export function formatInteger(value: Numeric): string {
  const parsed = toNumber(value)
  return parsed === null ? EMPTY : integerFormatter.format(parsed)
}

const decimalFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Compact magnitude steps, largest first, each a thousand times the next. */
const COMPACT_STEPS = [
  { min: 1_000_000_000_000, suffix: 'B' },
  { min: 1_000_000_000, suffix: 'mil M' },
  { min: 1_000_000, suffix: 'M' },
  { min: 1_000, suffix: 'mil' },
] as const

/** Scales a number onto a single magnitude step with one decimal, e.g. `3,7 mil M`. */
function formatCompactNumber(parsed: number): string {
  const index = COMPACT_STEPS.findIndex((step) => Math.abs(parsed) >= step.min)
  if (index === -1) return integerFormatter.format(parsed)
  const current = COMPACT_STEPS[index]
  if (current === undefined) return integerFormatter.format(parsed)
  const overflows = Math.abs(parsed) / current.min >= 999.95
  const promoted = COMPACT_STEPS[index - 1]
  const step = overflows && promoted !== undefined ? promoted : current
  return `${decimalFormatter.format(parsed / step.min)} ${step.suffix}`
}

/** Compact currency for KPI tiles, e.g. `$ 43,5 mil M`. */
export function formatArsCompact(value: Numeric): string {
  const parsed = toNumber(value)
  return parsed === null ? EMPTY : `$ ${formatCompactNumber(parsed)}`
}

export function formatPercent(value: Numeric, fractionDigits = 1): string {
  const parsed = toNumber(value)
  if (parsed === null) return EMPTY
  return `${parsed.toLocaleString('es-AR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} %`
}

/** Quantity with one decimal and its unit of measure, e.g. `12,5 unidad`. */
export function formatQuantity(value: Numeric, unit?: string | null): string {
  const parsed = toNumber(value)
  if (parsed === null) return EMPTY
  const rendered = decimalFormatter.format(parsed)
  return unit ? `${rendered} ${unit}` : rendered
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Formats a `date` column without the UTC-midnight off-by-one. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return EMPTY
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (match) {
    const [, year, month, day] = match
    return dateFormatter.format(new Date(Number(year), Number(month) - 1, Number(day)))
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed)
}
