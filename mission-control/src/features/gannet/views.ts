/**
 * Registry of the read-only `public.gd_*` views that back the demo modules.
 *
 * One registry instead of thirteen near-identical API routes. Every module hits
 * `/api/gannet/<view>`; this table is the allow-list that decides which view
 * names are legal, how they are ordered, how many rows may be pulled, and which
 * columns may be filtered on. Anything not listed here is a 404 — the route
 * never interpolates a caller-supplied string into a query.
 *
 * `maxRows` matters: PostgREST runs with `PGRST_DB_MAX_ROWS=1000`, so any view
 * above that ceiling (work orders at 1,350) is silently truncated by a single
 * request. The route pages through with `.range()` until it has `maxRows` or the
 * view runs out. Keep `maxRows` at or just above the real row count so the demo
 * never pays for pages that do not exist.
 */

export type ViewConfig = {
  /** Default ordering applied server-side. */
  readonly order?: { readonly column: string; readonly ascending: boolean }
  /** Upper bound on rows returned. Fetched in 1,000-row pages when above that. */
  readonly maxRows: number
  /** Columns callers may filter on with `?column=value`. */
  readonly filters?: readonly string[]
}

export const GANNET_VIEWS = {
  // --- Executive -----------------------------------------------------------
  gd_kpi_ejecutivo: { maxRows: 1 },

  // --- Clients -------------------------------------------------------------
  gd_clientes: {
    order: { column: 'facturado_ars', ascending: false },
    maxRows: 100,
  },
  gd_cliente_detalle: {
    order: { column: 'cliente_id', ascending: true },
    maxRows: 100,
    filters: ['cliente_id'],
  },

  // --- Quotes --------------------------------------------------------------
  gd_cotizaciones: {
    order: { column: 'fecha_emision', ascending: false },
    maxRows: 600,
  },
  gd_pipeline_cotizaciones: {
    order: { column: 'orden_embudo', ascending: true },
    maxRows: 20,
  },

  // --- Projects ------------------------------------------------------------
  gd_proyectos_estado: {
    order: { column: 'dias_atraso', ascending: false },
    maxRows: 200,
  },

  // --- Work orders ---------------------------------------------------------
  gd_ot_operativas: {
    order: { column: 'fecha_programada', ascending: false },
    maxRows: 1500,
  },
  gd_ot_carga_operativa: {
    order: { column: 'orden_estado', ascending: true },
    maxRows: 100,
  },

  // --- Purchasing ----------------------------------------------------------
  gd_ordenes_compra: {
    order: { column: 'fecha_emision', ascending: false },
    maxRows: 800,
  },
  gd_compras_por_proveedor: {
    order: { column: 'monto_total_ars', ascending: false },
    maxRows: 100,
  },

  // --- Stock ---------------------------------------------------------------
  gd_articulos: {
    order: { column: 'valorizado_ars', ascending: false },
    maxRows: 300,
  },
  gd_stock_critico: {
    order: { column: 'cobertura_pct', ascending: true },
    maxRows: 200,
  },

  // --- Equipment -----------------------------------------------------------
  gd_equipos: {
    order: { column: 'codigo_interno', ascending: true },
    maxRows: 400,
  },
  gd_equipos_disponibilidad: {
    order: { column: 'categoria', ascending: true },
    maxRows: 100,
  },

  // --- Fleet ---------------------------------------------------------------
  gd_flota_estado: {
    order: { column: 'dias_para_vtv', ascending: true },
    maxRows: 100,
  },

  // --- HR ------------------------------------------------------------------
  gd_empleados: {
    order: { column: 'legajo', ascending: true },
    maxRows: 300,
  },
  gd_rrhh_resumen: {
    order: { column: 'dotacion_activa', ascending: false },
    maxRows: 50,
  },

  // --- Invoicing -----------------------------------------------------------
  gd_facturas: {
    order: { column: 'fecha_emision', ascending: false },
    maxRows: 1100,
  },
  gd_cobranzas_aging: {
    order: { column: 'orden_tramo', ascending: false },
    maxRows: 200,
  },

  // --- Documents -----------------------------------------------------------
  gd_documentos: {
    order: { column: 'fecha_vencimiento', ascending: true },
    maxRows: 900,
  },
  gd_documentos_vencimientos: {
    order: { column: 'orden_tramo', ascending: true },
    maxRows: 200,
  },
} as const satisfies Record<string, ViewConfig>

export type GannetViewName = keyof typeof GANNET_VIEWS

export const GANNET_VIEW_NAMES = Object.keys(GANNET_VIEWS) as GannetViewName[]

export function isGannetView(name: string): name is GannetViewName {
  return Object.hasOwn(GANNET_VIEWS, name)
}
