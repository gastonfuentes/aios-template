/**
 * Company-wide overview tools: executive KPIs, work-order load, revenue by
 * service line and the monthly billing curve. These answer the broadest
 * questions ("how is the company doing", "how many open work orders").
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectOne, selectView } from '../supabase.js'
import { formatArsCompact, formatInteger, formatPercent, toNumber } from '../format.js'
import { noData, text, type ToolResult } from './helpers.js'

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
    .map(([estado, v]) => `- ${estado.replace(/_/g, ' ')}: ${formatInteger(v.total)}${v.atrasadas > 0 ? ` (atrasadas: ${formatInteger(v.atrasadas)})` : ''}`)
  const header = `Órdenes de trabajo: ${formatInteger(k.ot_abiertas)} abiertas, de las cuales ${formatInteger(k.ot_criticas)} críticas y ${formatInteger(k.ot_en_ejecucion)} en ejecución. Completadas este mes: ${formatInteger(k.ot_completadas_mes)}.`
  return `${header}\n\nDistribución por estado:\n${lines.join('\n')}`
}

const workOrders = tool(
  'work_orders',
  'Estado de las órdenes de trabajo (OT): cantidad total de abiertas, críticas, en ejecución y completadas del mes, más la distribución por estado (programada, en ejecución, pausada, completada, cancelada, borrador) y las atrasadas. Usar para "cuántas OT hay", "OT abiertas", "OT críticas", "trabajos atrasados".',
  {},
  async (): Promise<ToolResult> => {
    const k = await selectOne<KpiRow>('gd_kpi_ejecutivo', KPI_SELECT)
    const rows = await selectView<OtCargaRow>(
      'gd_ot_carga_operativa',
      'select=estado,cantidad,atrasadas,esta_abierta&limit=200',
    )
    if (k === null || rows.length === 0) return noData('las órdenes de trabajo')
    return text(renderWorkOrders(k, aggregateByEstado(rows)))
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
  { months: z.number().int().min(1).max(12).optional() },
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

export const OVERVIEW_TOOLS = [overview, workOrders, revenueByService, billingMonthly]
