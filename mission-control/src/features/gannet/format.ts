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

const compactArsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})

/**
 * Compact currency for KPI tiles. Full figures in the billions blow past the
 * width of a card; `$ 43,5 MM` stays readable from the back of a stand.
 */
export function formatArsCompact(value: Numeric): string {
  const parsed = toNumber(value)
  return parsed === null ? EMPTY : compactArsFormatter.format(parsed)
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
