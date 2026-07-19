/**
 * Semantic tones for the demo modules.
 *
 * Every badge, stat tile and row highlight resolves its color through here, so
 * "overdue" looks the same in fleet, invoicing and documents. The presenter can
 * point at any red element in any module and mean the same thing.
 *
 * Colors resolve to the Mission Control system CSS variables rather than raw hex
 * so they follow the light/dark theme automatically.
 */

export type Tone = 'neutral' | 'info' | 'positive' | 'warning' | 'critical' | 'accent'

export const TONE_COLOR: Record<Tone, string> = {
  neutral: 'var(--label-tertiary)',
  info: 'var(--sys-blue)',
  positive: 'var(--sys-green)',
  warning: 'var(--sys-orange)',
  critical: 'var(--sys-red)',
  accent: 'var(--sys-yellow)',
}

/**
 * Tone for a day countdown: already past is critical, inside the warning window
 * is warning, anything further out is neutral.
 *
 * Used for every expiry in the demo — vehicle inspections, insurance, equipment
 * calibration, document validity, invoice due dates.
 */
export function toneForDaysRemaining(days: number | null | undefined, warningDays = 30): Tone {
  if (days === null || days === undefined) return 'neutral'
  if (days < 0) return 'critical'
  if (days <= warningDays) return 'warning'
  return 'positive'
}

/**
 * Tone for a stock coverage ratio (current quantity over minimum, as a
 * percentage). Zero coverage is critical, below the minimum is warning.
 */
export function toneForCoverage(coveragePct: number | null | undefined): Tone {
  if (coveragePct === null || coveragePct === undefined) return 'neutral'
  if (coveragePct <= 0) return 'critical'
  if (coveragePct < 50) return 'critical'
  if (coveragePct < 100) return 'warning'
  return 'positive'
}
