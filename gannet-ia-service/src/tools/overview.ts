/**
 * Company-wide overview tools: executive KPIs, work-order load, revenue by
 * service line and the monthly billing curve. These answer the broadest
 * questions ("how is the company doing", "how many open work orders").
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectOne, selectPage, selectView } from '../supabase.js'
import { formatArsCompact, formatDate, formatInteger, formatPercent, toNumber } from '../format.js'
import { WORK_ORDER_PRIORITY, WORK_ORDER_STATE, label } from '../labels.js'
import { listedNote, noData, partialWarning, text, type ToolResult } from './helpers.js'

interface KpiRow {
  readonly facturacion_mes_ars: string | number | null
  readonly facturacion_ytd_ars: string | number | null
  readonly cobranza_pendiente_ars: string | number | null
  readonly cobranza_vencida_ars: string | number | null
  readonly facturas_pendientes: number | null
  readonly ot_abiertas: number | null
  readonly ot_criticas: number | null
  readonly ot_en_ejecucion: number | null
  readonly ot_completadas_mes: number | null
  readonly proyectos_activos: number | null
  readonly pipeline_abierto_ars: string | number | null
  readonly dotacion_activa: number | null
  readonly clientes_activos: number | null
  readonly flota_apta_circular: number | null
  readonly flota_total: number | null
  readonly equipos_disponibles: number | null
  readonly equipos_total: number | null
}

const KPI_SELECT =
  'select=facturacion_mes_ars,facturacion_ytd_ars,cobranza_pendiente_ars,cobranza_vencida_ars,facturas_pendientes,ot_abiertas,ot_criticas,ot_en_ejecucion,ot_completadas_mes,proyectos_activos,pipeline_abierto_ars,dotacion_activa,clientes_activos,flota_apta_circular,flota_total,equipos_disponibles,equipos_total'

function renderKpi(k: KpiRow): string {
  return [
    'Resumen ejecutivo de la empresa:',
    `- Facturación del mes: ${formatArsCompact(k.facturacion_mes_ars)}; YTD: ${formatArsCompact(k.facturacion_ytd_ars)}.`,
    `- Cobranza pendiente: ${formatArsCompact(k.cobranza_pendiente_ars)}; de la cual vencida: ${formatArsCompact(k.cobranza_vencida_ars)} (${formatInteger(k.facturas_pendientes)} facturas pendientes).`,
    `- Órdenes de trabajo abiertas: ${formatInteger(k.ot_abiertas)} (críticas: ${formatInteger(k.ot_criticas)}, en ejecución: ${formatInteger(k.ot_en_ejecucion)}); completadas este mes: ${formatInteger(k.ot_completadas_mes)}.`,
    `- Proyectos activos: ${formatInteger(k.proyectos_activos)}; pipeline comercial abierto: ${formatArsCompact(k.pipeline_abierto_ars)}.`,
    `- Dotación activa: ${formatInteger(k.dotacion_activa)}; clientes activos: ${formatInteger(k.clientes_activos)}.`,
    `- Flota apta para circular: ${formatInteger(k.flota_apta_circular)} de ${formatInteger(k.flota_total)} activos; equipos disponibles: ${formatInteger(k.equipos_disponibles)} de ${formatInteger(k.equipos_total)}.`,
  ].join('\n')
}

const overview = tool(
  'overview',
  'Resumen ejecutivo global de Andes Servicios Integrales: facturación del mes y del año, cobranza pendiente y vencida, órdenes de trabajo abiertas y críticas, proyectos activos, pipeline comercial, dotación, clientes, estado de flota y equipos. Usar para preguntas amplias del tipo "cómo está la empresa" o cuando se pide un panorama general.',
  {},
  async (): Promise<ToolResult> => {
    const k = await selectOne<KpiRow>('gd_kpi_ejecutivo', KPI_SELECT)
    return k === null ? noData('el resumen ejecutivo') : text(renderKpi(k))
  },
)

interface OtCargaRow {
  readonly estado: string
  readonly cantidad: number | null
  readonly atrasadas: number | null
  readonly esta_abierta: boolean | null
}

function aggregateByEstado(rows: readonly OtCargaRow[]): Map<string, { total: number; abiertas: number; atrasadas: number }> {
  const byEstado = new Map<string, { total: number; abiertas: number; atrasadas: number }>()
  for (const row of rows) {
    const prev = byEstado.get(row.estado) ?? { total: 0, abiertas: 0, atrasadas: 0 }
    const qty = toNumber(row.cantidad) ?? 0
    byEstado.set(row.estado, {
      total: prev.total + qty,
      abiertas: prev.abiertas + (row.esta_abierta ? qty : 0),
      atrasadas: prev.atrasadas + (toNumber(row.atrasadas) ?? 0),
    })
  }
  return byEstado
}

function renderWorkOrders(k: KpiRow, byEstado: Map<string, { total: number; abiertas: number; atrasadas: number }>): string {
  const lines = [...byEstado.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([estado, v]) => `- ${label(WORK_ORDER_STATE, estado)}: ${formatInteger(v.total)}${v.atrasadas > 0 ? ` (atrasadas: ${formatInteger(v.atrasadas)})` : ''}`)
  const header = `Órdenes de trabajo: ${formatInteger(k.ot_abiertas)} abiertas, de las cuales ${formatInteger(k.ot_criticas)} críticas y ${formatInteger(k.ot_en_ejecucion)} en ejecución. Completadas este mes: ${formatInteger(k.ot_completadas_mes)}.`
  return `${header}\n\nDistribución por estado:\n${lines.join('\n')}`
}

const workOrders = tool(
  'work_orders',
  'Estado de las órdenes de trabajo (OT): cantidad total de abiertas, críticas, en ejecución y completadas del mes, más la distribución por estado (programada, en ejecución, pausada, completada, cancelada, borrador) y las atrasadas. Usar para "cuántas OT hay", "OT abiertas", "OT críticas", "trabajos atrasados".',
  {},
  async (): Promise<ToolResult> => {
    const k = await selectOne<KpiRow>('gd_kpi_ejecutivo', KPI_SELECT)
    // The per-estado breakdown sums `cantidad` over these rows; a cut page would
    // drop whole states from a distribution presented as complete.
    const page = await selectPage<OtCargaRow>(
      'gd_ot_carga_operativa',
      'select=estado,cantidad,atrasadas,esta_abierta&limit=200',
    )
    if (k === null || page.rows.length === 0) return noData('las órdenes de trabajo')
    const body = renderWorkOrders(k, aggregateByEstado(page.rows))
    return text(`${body}${partialWarning(page, 'grupos de OT')}`)
  },
)

// --- Work-order detail -------------------------------------------------------

interface WorkOrderRow {
  readonly ot_numero: string | null
  readonly titulo: string | null
  readonly cliente: string | null
  readonly responsable: string | null
  readonly vehiculo_dominio: string | null
  readonly prioridad: string | null
  readonly estado: string | null
  readonly fecha_programada: string | null
  readonly esta_atrasada: boolean | null
}

/** Work orders the query reads; the true total always comes from the row count. */
const WO_QUERY_CAP = 60

/** Work orders spelled out one by one; the rest are covered by the stated total. */
const WO_LIST_CAP = 15

const WO_STATES = ['borrador', 'programada', 'en_ejecucion', 'pausada', 'completada', 'cancelada'] as const
const WO_PRIORITIES = ['baja', 'media', 'alta', 'critica'] as const

const workOrdersList = tool(
  'work_orders_list',
  'Detalle de órdenes de trabajo individuales: número, título, cliente, responsable, prioridad, estado, fecha programada y si están atrasadas. Filtros por estado, prioridad, solo abiertas y solo atrasadas. Usar para "listame las OT críticas abiertas", "qué OT están atrasadas", "detalle de las órdenes en ejecución", "qué trabajos tiene programados tal responsable". Para el conteo agregado por estado usar work_orders.',
  {
    estado: z.enum(WO_STATES).optional(),
    prioridad: z.enum(WO_PRIORITIES).optional(),
    solo_abiertas: z.boolean().optional(),
    solo_atrasadas: z.boolean().optional(),
  },
  async (args): Promise<ToolResult> => {
    const filters: string[] = []
    if (args.estado !== undefined) filters.push(`estado=eq.${args.estado}`)
    if (args.prioridad !== undefined) filters.push(`prioridad=eq.${args.prioridad}`)
    if (args.solo_abiertas === true) filters.push('esta_abierta=is.true')
    if (args.solo_atrasadas === true) filters.push('esta_atrasada=is.true')
    const filterQuery = filters.length > 0 ? `&${filters.join('&')}` : ''

    const page = await selectPage<WorkOrderRow>(
      'gd_ot_operativas',
      `select=ot_numero,titulo,cliente,responsable,vehiculo_dominio,prioridad,estado,fecha_programada,esta_atrasada&order=fecha_programada.desc${filterQuery}&limit=${WO_QUERY_CAP}`,
    )
    const rows = page.rows

    const scope = [
      args.prioridad !== undefined ? `de prioridad ${label(WORK_ORDER_PRIORITY, args.prioridad).toLowerCase()}` : null,
      args.estado !== undefined ? `en estado "${label(WORK_ORDER_STATE, args.estado)}"` : null,
      args.solo_abiertas === true ? 'abiertas' : null,
      args.solo_atrasadas === true ? 'atrasadas' : null,
    ]
      .filter(Boolean)
      .join(' y ')
    const what = scope ? `órdenes de trabajo ${scope}` : 'órdenes de trabajo'

    if (rows.length === 0) return text(`No hay ${what}.`)

    const lines = rows.slice(0, WO_LIST_CAP).map((r) => {
      const atrasada = r.esta_atrasada === true ? ' (atrasada)' : ''
      const veh = r.vehiculo_dominio ? ` · ${r.vehiculo_dominio}` : ''
      const resp = r.responsable ? ` · resp. ${r.responsable}` : ''
      return `- ${r.ot_numero ?? 'sin número'} — ${r.titulo ?? 'sin título'} · ${r.cliente ?? 'sin cliente'} · ${label(WORK_ORDER_STATE, r.estado)} · prioridad ${label(WORK_ORDER_PRIORITY, r.prioridad)} · programada ${formatDate(r.fecha_programada)}${atrasada}${veh}${resp}`
    })
    const total = page.total ?? rows.length
    const header = `${what.charAt(0).toUpperCase()}${what.slice(1)}: ${formatInteger(total)} en total, de la más reciente a la más antigua.`
    const note = listedNote(lines.length, total, 'órdenes de trabajo')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
  },
)

interface ServiceRow {
  readonly servicio: string
  readonly facturado_ars: string | number | null
  readonly participacion_pct: string | number | null
}

const revenueByService = tool(
  'revenue_by_service',
  'Ingresos facturados por línea de servicio (mantenimiento industrial, obras civiles, soldadura y montaje, electricidad, transporte, etc.) con su participación porcentual sobre el total. Usar para "qué servicio factura más", "ingresos por rubro", "mix de servicios".',
  {},
  async (): Promise<ToolResult> => {
    const rows = await selectView<ServiceRow>(
      'gd_ingresos_por_servicio',
      'select=servicio,facturado_ars,participacion_pct&order=facturado_ars.desc&limit=15',
    )
    if (rows.length === 0) return noData('los ingresos por servicio')
    const lines = rows.map(
      (r, i) => `${i + 1}. ${r.servicio}: ${formatArsCompact(r.facturado_ars)} (${formatPercent(r.participacion_pct)} del total)`,
    )
    return text(`Ingresos facturados por línea de servicio:\n${lines.join('\n')}`)
  },
)

interface BillingRow {
  readonly etiqueta: string
  readonly emitido_ars: string | number | null
  readonly cobrado_ars: string | number | null
  readonly es_mes_parcial: boolean | null
}

const billingMonthly = tool(
  'billing_monthly',
  'Curva de facturación mensual: monto emitido y cobrado por mes, marcando el mes en curso como parcial. Usar para "facturación de este mes", "cómo viene la facturación", "evolución mensual", "cuánto cobramos".',
  { months: z.number().int().min(1).max(18).optional() },
  async (args): Promise<ToolResult> => {
    const limit = args.months ?? 6
    const rows = await selectView<BillingRow>(
      'gd_facturacion_mensual',
      `select=etiqueta,emitido_ars,cobrado_ars,es_mes_parcial&order=mes.desc&limit=${limit}`,
    )
    if (rows.length === 0) return noData('la facturación mensual')
    const lines = rows.map(
      (r) => `- ${r.etiqueta}${r.es_mes_parcial ? ' (mes parcial en curso)' : ''}: emitido ${formatArsCompact(r.emitido_ars)}, cobrado ${formatArsCompact(r.cobrado_ars)}`,
    )
    return text(`Facturación mensual (más reciente primero):\n${lines.join('\n')}`)
  },
)

export const OVERVIEW_TOOLS = [overview, workOrders, workOrdersList, revenueByService, billingMonthly]
