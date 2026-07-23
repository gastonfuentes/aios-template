/**
 * Read-only PostgREST client for the `public.gd_*` demo views.
 *
 * This is the service's entire data surface. It issues nothing but `GET`
 * requests with the public anon key — the same mechanism mission-control's
 * `features/gannet-ia/queries.ts` uses. The anon role is SELECT-only on these
 * views by grant, but this module never constructs anything other than a GET
 * regardless, so there is no write path even in principle.
 *
 * A non-2xx response or a non-array body yields an empty list instead of
 * throwing, so a tool degrades to an honest "no data" rather than a stack trace
 * on stage.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL, TOOL_TIMEOUT_MS } from './config.js'

/**
 * Hard server-side page ceiling: `PGRST_DB_MAX_ROWS` on the `supabase-rest`
 * container. PostgREST truncates at this many rows and says nothing about it in
 * the body, so a `limit` above this value is a lie — it reads as "give me
 * everything" while silently capping. Every `limit` in the tools stays at or
 * below it, and the real total always comes from `Content-Range` instead.
 */
export const MAX_PAGE_ROWS = 1000

/**
 * One page of rows plus the number of rows the view actually holds for the same
 * filter.
 *
 * `rows.length` is only ever the size of the page requested; deriving a headcount
 * from it reports the `limit` as if it were the truth. `total` comes from the
 * `Content-Range` response header and is the figure a tool must narrate.
 */
export interface ViewPage<T> {
  /** The rows this page carried. Never more than the request's `limit`. */
  readonly rows: T[]
  /** Rows matching the filter server-side, or null when the header was absent. */
  readonly total: number | null
  /** True when the view holds more rows than this page carried. */
  readonly truncated: boolean
}

const EMPTY_PAGE: ViewPage<never> = { rows: [], total: null, truncated: false }

/**
 * Reads the total out of a `Content-Range` header.
 *
 * PostgREST answers `0-39/54` for a partial page, `0-59/60` for a complete one
 * and a star-prefixed range ending in `/0` when nothing matched. The total is
 * whatever follows the slash; a star there means the count was not computed,
 * which is reported as "unknown" rather than as zero.
 */
function parseTotal(header: string | null): number | null {
  if (header === null) return null
  const match = /\/(\d+)\s*$/.exec(header)
  if (match === null) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Runs one read-only `GET` against a `gd_*` view.
 *
 * `view` is a fixed view name chosen by the calling tool, never user input.
 * `params` is a PostgREST query string (select / order / filter) built from
 * constants inside the tools. The request carries its own timeout so a slow
 * database can never hold a tool open past the answer budget.
 *
 * `exact` adds `Prefer: count=exact`, which costs the database an extra count
 * over the same filter and in exchange makes `total` real.
 */
async function fetchPage<T>(view: string, params: string, exact: boolean): Promise<ViewPage<T>> {
  if (SUPABASE_URL === '' || SUPABASE_ANON_KEY === '') return EMPTY_PAGE

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${view}?${params}`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
        // A counted page comes back as 206 Partial Content, which is still `ok`.
        ...(exact ? { Prefer: 'count=exact' } : {}),
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      // An empty array is indistinguishable from a legitimate no-rows answer, so
      // a missing view, a broken filter or a revoked grant would look normal to
      // the presenter and leave no trace. Log it: `journalctl -u gannet-ia`
      // is the only place this can surface.
      console.error(`[selectView] ${view} responded ${res.status}`)
      return EMPTY_PAGE
    }
    const body: unknown = await res.json()
    const rows = Array.isArray(body) ? (body as T[]) : []
    const total = exact ? parseTotal(res.headers.get('content-range')) : null
    return { rows, total, truncated: total !== null && rows.length < total }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[selectView] ${view} failed: ${reason}`)
    return EMPTY_PAGE
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Rows only, with no count round-trip.
 *
 * Use this when the answer never states "how many" — a single KPI row, a
 * declared top-N ranking, a lookup by key. Anything that narrates a quantity
 * must use `selectPage` instead.
 */
export async function selectView<T>(view: string, params: string): Promise<T[]> {
  const page = await fetchPage<T>(view, params, false)
  return page.rows
}

/**
 * Rows plus the real total behind them.
 *
 * This is the call for every tool that reports a count, sums a column or lists
 * "all" of something: `page.total` is what the dashboard would show, and
 * `page.truncated` says whether the page was complete enough to aggregate over.
 */
export async function selectPage<T>(view: string, params: string): Promise<ViewPage<T>> {
  return fetchPage<T>(view, params, true)
}

/**
 * Counts rows matching a filter without transporting them.
 *
 * Asks for a single row purely so `Content-Range` carries the total; returns
 * null when the count could not be established, which callers must not confuse
 * with zero.
 */
export async function countView(view: string, params: string): Promise<number | null> {
  const page = await selectPage<unknown>(view, `${params}&limit=1`)
  return page.total
}

/** Returns the first row of a view, or null when the view is empty. */
export async function selectOne<T>(view: string, params: string): Promise<T | null> {
  const rows = await selectView<T>(view, params)
  return rows.length > 0 ? (rows[0] as T) : null
}
