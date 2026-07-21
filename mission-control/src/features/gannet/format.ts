/**
 * Shared formatters for the demo modules.
 *
 * Every number the audience sees goes through here so currency, dates and
 * percentages read identically across the thirteen modules. All locales are
 * `es-AR` — the demo is presented to an Argentine mining audience.
 *
 * PostgREST returns `numeric` columns as strings to preserve precision, so every
 * numeric formatter accepts `string | number | null` and coerces defensively.
 * A value that cannot be coerced renders as an em dash rather than `NaN`.
 */

/** Placeholder for absent values. Never render `NaN`, `null` or `$ 0` for missing data. */
export const EMPTY = '—'

export type Numeric = number | string | null | undefined

/** Coerces a PostgREST numeric (string or number) to a number, or null. */
export function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatArs(value: Numeric): string {
  const parsed = toNumber(value)
  return parsed === null ? EMPTY : arsFormatter.format(parsed)
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

export function formatDecimal(value: Numeric): string {
  const parsed = toNumber(value)
  return parsed === null ? EMPTY : decimalFormatter.format(parsed)
}

/**
 * Compact magnitude steps, largest first, each a thousand times the next.
 *
 * Selection is by fixed threshold rather than by `Intl` compact notation, which
 * `es-AR` gets wrong at exactly the scale this demo lives in: CLDR maps 1e9 to a
 * `0000 M` pattern, so 3.749.400.000 renders as `3749,4 M` while 23.700.000.000
 * renders as `23,7 mil M`. Two figures one order of magnitude apart, shown in
 * units that do not step — side by side on a card row it reads as a bug. The
 * same formatter also alternates `K` and `k` between thousands, which no amount
 * of option tuning fixes.
 */
const COMPACT_STEPS = [
  { min: 1_000_000_000_000, suffix: 'B' },
  { min: 1_000_000_000, suffix: 'mil M' },
  { min: 1_000_000, suffix: 'M' },
  { min: 1_000, suffix: 'mil' },
] as const

/**
 * Scales a number onto a single magnitude step with one decimal, e.g. `3,7 mil M`.
 * Below a thousand there is nothing to compact, so the plain integer is returned.
 */
function formatCompactNumber(parsed: number): string {
  const index = COMPACT_STEPS.findIndex((step) => Math.abs(parsed) >= step.min)
  if (index === -1) return integerFormatter.format(parsed)
  // Rounding to one decimal can push a value onto the step above: 999.950.000
  // scales to 999,95 and would render as `1.000,0 M` — the very inconsistency
  // this function exists to prevent. Promote it to `1,0 mil M` instead.
  const overflows = Math.abs(parsed) / COMPACT_STEPS[index].min >= 999.95
  const step = overflows && index > 0 ? COMPACT_STEPS[index - 1] : COMPACT_STEPS[index]
  return `${decimalFormatter.format(parsed / step.min)} ${step.suffix}`
}

/**
 * Compact currency for KPI tiles. Full figures in the billions blow past the
 * width of a card; `$ 43,5 mil M` stays readable from the back of a stand.
 *
 * Every value picks its own step from the same fixed thresholds, so two figures
 * in one card row can never disagree about which unit their magnitude belongs to.
 */
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

/** Quantity with its unit of measure, e.g. `12,5 unidad`. */
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

const dateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Formats a `date` column. Parsed manually rather than through `new Date()`
 * because `new Date('2026-07-19')` is interpreted as UTC midnight and renders as
 * the previous day in Argentina (UTC-3).
 */
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

/** Formats a `timestamptz` column, including the time of day. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return EMPTY
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : dateTimeFormatter.format(parsed)
}

/**
 * Turns a snake_case enum value from the database into readable prose:
 * `en_negociacion` becomes `En negociación`? No — accents cannot be recovered
 * from the raw value, so this only replaces underscores and capitalizes. Modules
 * with a fixed, known set of states should map them explicitly for correct
 * accents; this is the fallback for open-ended values.
 */
export function humanize(value: string | null | undefined): string {
  if (!value) return EMPTY
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Renders a day countdown as prose: overdue, due today, or days remaining. */
export function formatDaysRemaining(days: number | null | undefined): string {
  if (days === null || days === undefined) return EMPTY
  if (days < 0) return `Vencido hace ${Math.abs(days)} d`
  if (days === 0) return 'Vence hoy'
  return `En ${days} d`
}
