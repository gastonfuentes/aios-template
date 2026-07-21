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
 * Runs one read-only `GET` against a `gd_*` view.
 *
 * `view` is a fixed view name chosen by the calling tool, never user input.
 * `params` is a PostgREST query string (select / order / filter) built from
 * constants inside the tools. The request carries its own timeout so a slow
 * database can never hold a tool open past the answer budget.
 */
export async function selectView<T>(view: string, params: string): Promise<T[]> {
  if (SUPABASE_URL === '' || SUPABASE_ANON_KEY === '') return []

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${view}?${params}`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
    if (!res.ok) {
      // An empty array is indistinguishable from a legitimate no-rows answer, so
      // a missing view, a broken filter or a revoked grant would look normal to
      // the presenter and leave no trace. Log it: `journalctl -u gannet-ia`
      // is the only place this can surface.
      console.error(`[selectView] ${view} responded ${res.status}`)
      return []
    }
    const body: unknown = await res.json()
    return Array.isArray(body) ? (body as T[]) : []
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[selectView] ${view} failed: ${reason}`)
    return []
  } finally {
    clearTimeout(timeout)
  }
}

/** Returns the first row of a view, or null when the view is empty. */
export async function selectOne<T>(view: string, params: string): Promise<T | null> {
  const rows = await selectView<T>(view, params)
  return rows.length > 0 ? (rows[0] as T) : null
}
