/**
 * GET /api/gannet/<view> — generic reader for the `public.gd_*` demo views.
 *
 * One parameterized route instead of thirteen near-identical ones. The thirteen
 * modules differ only in which view they read, how it is ordered and how many
 * rows they need — all of which is data, not code. That data lives in
 * `GANNET_VIEWS`, which doubles as the security allow-list: `view` is validated
 * against it before it ever reaches a query, so no caller-supplied string is
 * interpolated into PostgREST.
 *
 * Follows the `/api/proveedores` pattern: `runtime='nodejs'`,
 * `dynamic='force-dynamic'`, zod validation, and the standard anon-key server
 * client from `@/core/adapters/supabase/server` — no service role. The views are
 * granted to `anon` for kiosk mode.
 *
 * Paging is not an optimization here, it is a correctness requirement:
 * PostgREST runs with `PGRST_DB_MAX_ROWS=1000`, so a single request against
 * `gd_ot_operativas` (1,350 rows) silently returns a truncated result. This
 * route pages with `.range()` until it reaches the view's configured `maxRows`
 * or the view is exhausted.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/core/adapters/supabase/server'
import { GANNET_VIEWS, isGannetView, type GannetViewName } from '@/features/gannet/views'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** PostgREST's hard per-request ceiling. Pages are sized to match it exactly. */
const PAGE_SIZE = 1000

/** Filter values are opaque scalars; length-capped so a filter cannot become a payload. */
const FilterValueSchema = z.string().min(1).max(120)

export type GannetViewResponse<T = unknown> = {
  rows: T[]
  error?: string
}

function fail(message: string, status: number): NextResponse<GannetViewResponse> {
  return NextResponse.json({ rows: [], error: message }, { status })
}

export async function GET(
  req: Request,
  context: { params: Promise<{ view: string }> },
): Promise<Response> {
  const { view } = await context.params

  if (!isGannetView(view)) {
    return fail('Vista no disponible.', 404)
  }

  const name: GannetViewName = view
  const config = GANNET_VIEWS[name]
  const searchParams = new URL(req.url).searchParams

  // Only columns explicitly declared filterable are honoured. Unknown params are
  // ignored rather than rejected, so adding a client-side query string never
  // breaks a module mid-demo.
  const filters: Array<[string, string]> = []
  const allowedFilters: readonly string[] =
    'filters' in config && config.filters !== undefined ? config.filters : []

  for (const column of allowedFilters) {
    const raw = searchParams.get(column)
    if (raw === null) continue
    const parsed = FilterValueSchema.safeParse(raw)
    if (!parsed.success) {
      return fail(`Valor inválido para el filtro "${column}".`, 400)
    }
    filters.push([column, parsed.data])
  }

  const supabase = await createClient()
  const rows: unknown[] = []

  try {
    while (rows.length < config.maxRows) {
      const from = rows.length
      const to = Math.min(from + PAGE_SIZE, config.maxRows) - 1

      let query = supabase.from(name).select('*').range(from, to)

      if ('order' in config && config.order !== undefined) {
        query = query.order(config.order.column, {
          ascending: config.order.ascending,
          nullsFirst: false,
        })
      }

      for (const [column, value] of filters) {
        query = query.eq(column, value)
      }

      const { data, error } = await query
      if (error) {
        return fail(error.message, 500)
      }

      const page = data ?? []
      rows.push(...page)

      // A short page means the view is exhausted — stop before an empty request.
      if (page.length < to - from + 1) break
    }
  } catch {
    return fail('No se pudo consultar la información.', 500)
  }

  return NextResponse.json({ rows } satisfies GannetViewResponse)
}
