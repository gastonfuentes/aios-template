/**
 * Small shared arithmetic for the executive dashboard.
 *
 * Lives outside the components because the same ratio is needed both by the
 * hero banner (overdue share of the pending receivable) and by the KPI band
 * (fleet and equipment availability), and neither should import the other.
 */

/** Percentage of `part` over `total`, or null when the ratio is undefined. */
export function ratio(part: number | null | undefined, total: number | null | undefined): number | null {
  if (part === null || part === undefined) return null
  if (total === null || total === undefined || total === 0) return null
  return (part / total) * 100
}
