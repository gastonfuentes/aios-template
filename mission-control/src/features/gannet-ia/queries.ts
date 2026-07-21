import 'server-only'

/**
 * Read-only queries for the deterministic AI screen (`/ia`).
 *
 * Stage 1 of the AI module wires NO language model. The answers are built from
 * curated queries over the same `public.gd_*` views the demo modules read, so a
 * visitor's question is grounded in the real seeded data and never invented.
 *
 * This file is the entire data surface of the feature and is intentionally
 * self-contained: it talks straight to Supabase PostgREST with the public anon
 * key over `fetch`, and does nothing the anon role is not already granted. It
 * shares nothing with the `agent-server/` daemon or the `/ai-agent` chat — those
 * run with elevated tools and must never be reachable from this kiosk route.
 *
 * `import 'server-only'` guarantees the module cannot be pulled into a client
 * bundle. Every function is a plain `SELECT`; there is no write path here.
 */

/** PostgREST base for the demo database. Anon key is public by design (kiosk). */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** A single vehicle barred from the road, with the reason it fails. */
export interface FlotaNoAptoRow {
  readonly dominio: string
  readonly tipo: string | null
  readonly marca: string | null
  readonly modelo: string | null
  readonly motivo_no_apto: string | null
  /**
   * Operational state. `'baja'` marks a decommissioned unit, which `/flota`
   * excludes from its "en condiciones de circular" denominator (35 / 44). The
   * answer builder keeps that distinction so its count reconciles with the card.
   */
  readonly estado: string | null
}

/**
 * One aging bucket of one client's receivables. The view is rolled up per
 * `(cliente, tramo)`, so a client with debt in several buckets appears in
 * several rows. `orden_tramo` orders the buckets from current (1, "A vencer")
 * through the overdue tiers (2–5); anything above 1 is genuinely overdue.
 *
 * `monto_ars` arrives as a string because PostgREST serializes `numeric` as text
 * to preserve precision; every consumer coerces through `format.toNumber`.
 */
export interface AgingRow {
  readonly cliente_id: number
  readonly cliente: string
  readonly tramo: string
  readonly orden_tramo: number | null
  readonly monto_ars: string | number | null
  readonly facturas: number | null
  readonly dias_vencido_maximo: number | null
  readonly vencimiento_mas_antiguo: string | null
}

/**
 * Runs one read-only `GET` against a `gd_*` view and returns its rows.
 *
 * The `signal` propagates the route's overall timeout so a slow database can
 * never hold the request open past its budget. A non-2xx response or a body that
 * is not an array yields an empty list rather than throwing, so the caller's
 * answer builder degrades to a clean "no data" instead of a stack trace on
 * stage.
 */
async function selectView<T>(view: string, params: string, signal: AbortSignal): Promise<T[]> {
  if (SUPABASE_URL === '' || ANON_KEY === '') return []

  const url = `${SUPABASE_URL}/rest/v1/${view}?${params}`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal,
  })

  if (!res.ok) return []

  const body: unknown = await res.json()
  return Array.isArray(body) ? (body as T[]) : []
}

/**
 * Vehicles that are not legally roadworthy, with the failing condition.
 *
 * Filters on the precomputed `apto_circular` flag rather than re-deriving
 * fitness here, so the list is byte-identical to the "Apto circular" column on
 * `/flota`. Ordered by reason then plate for a stable, readable answer.
 */
export function fetchFlotaNoApto(signal: AbortSignal): Promise<FlotaNoAptoRow[]> {
  return selectView<FlotaNoAptoRow>(
    'gd_flota_estado',
    'select=dominio,tipo,marca,modelo,motivo_no_apto,estado&apto_circular=eq.false&order=motivo_no_apto.asc,dominio.asc&limit=100',
    signal,
  )
}

/**
 * The full receivables aging table, every client and every bucket.
 *
 * The whole table is ~50 rows, so it is pulled once and the overdue slice is
 * derived in `answer.ts`. This mirrors how `/facturacion` reads the same view.
 */
export function fetchCobranzasAging(signal: AbortSignal): Promise<AgingRow[]> {
  return selectView<AgingRow>(
    'gd_cobranzas_aging',
    'select=cliente_id,cliente,tramo,orden_tramo,monto_ars,facturas,dias_vencido_maximo,vencimiento_mas_antiguo&order=orden_tramo.desc&limit=200',
    signal,
  )
}
