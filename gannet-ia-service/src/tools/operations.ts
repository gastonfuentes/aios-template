/**
 * Operational tools: equipment availability and calibration, the quote pipeline,
 * document expiries, and work-order compliance.
 *
 * These cover the questions a mining client asks first — "is your gear
 * certified", "are your people's documents current", "do you deliver on time" —
 * which the original tool set left unanswered.
 *
 * Same contract as every other tool here: a read-only `GET` against a fixed
 * `gd_*` view, with only validated numbers ever reaching the query string.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectView } from '../supabase.js'
import { formatArsCompact, formatInteger, formatPercent } from '../format.js'
import { noData, text, type ToolResult } from './helpers.js'

// --- Equipment ---------------------------------------------------------------

interface EquipmentRow {
  readonly categoria: string | null
  readonly estado: string | null
  readonly cantidad: number | null
  readonly alquilables: number | null
  readonly calibraciones_vencidas: number | null
  readonly calibraciones_por_vencer_30d: number | null
  readonly valor_total_ars: string | number | null
}

const equipmentStatus = tool(
  'equipment_status',
  'Parque de equipos por categoría: cantidad, disponibilidad, valor del parque y estado de calibración, incluidas las calibraciones vencidas y las que vencen en los próximos 30 días. Usar para "qué equipos tenemos", "cuánto vale el parque de equipos", "valor de los equipos", "equipos con calibración vencida", "calibraciones de instrumentos por vencer", "parque de equipos", "equipos disponibles".',
  {},
  async (): Promise<ToolResult> => {
    const rows = await selectView<EquipmentRow>(
      'gd_equipos_disponibilidad',
      'select=categoria,estado,cantidad,alquilables,calibraciones_vencidas,calibraciones_por_vencer_30d,valor_total_ars&order=cantidad.desc&limit=60',
    )
    if (rows.length === 0) return noData('el parque de equipos')

    // `overview` reports equipos_total excluding decommissioned units. Counting
    // them here too would publish two different park sizes under the same
    // question, so the totals are split the same way the fleet tools split them.
    const activos = rows.filter((r) => r.estado !== 'baja')
    const sum = (k: keyof EquipmentRow): number =>
      activos.reduce((acc, r) => acc + Number(r[k] ?? 0), 0)
    const debajas = rows.reduce(
      (acc, r) => acc + (r.estado === 'baja' ? Number(r.cantidad ?? 0) : 0),
      0,
    )
    const vencidas = sum('calibraciones_vencidas')
    const porVencer = sum('calibraciones_por_vencer_30d')

    const lines = activos.map((r) => {
      const cal =
        Number(r.calibraciones_vencidas ?? 0) > 0
          ? `, ${formatInteger(r.calibraciones_vencidas)} con calibración vencida`
          : ''
      return `- ${r.categoria ?? 'sin categoría'}: ${formatInteger(r.cantidad)} equipos (${formatInteger(r.alquilables)} alquilables)${cal}`
    })

    const bajaNote = debajas === 0 ? '' : ` (más ${formatInteger(debajas)} dados de baja, no contabilizados)`
    const header = `Parque de equipos: ${formatInteger(sum('cantidad'))} unidades activas${bajaNote}, valor ${formatArsCompact(sum('valor_total_ars'))}.`
    const calib = `Calibraciones: ${formatInteger(vencidas)} vencidas y ${formatInteger(porVencer)} por vencer en 30 días.`
    return text(`${header}\n${calib}\n\n${lines.join('\n')}`)
  },
)

// --- Quote pipeline ----------------------------------------------------------

interface PipelineRow {
  readonly etiqueta: string | null
  readonly estado: string | null
  readonly es_pipeline_abierto: boolean | null
  readonly cantidad: number | null
  readonly monto_nominal_ars: string | number | null
  readonly monto_ponderado_ars: string | number | null
  readonly probabilidad_promedio_pct: string | number | null
  readonly fuera_de_validez: number | null
}

const quotesPipeline = tool(
  'quotes_pipeline',
  'Embudo comercial de cotizaciones por estado: cantidad, monto nominal, monto ponderado por probabilidad y cuántas quedaron fuera de validez. Usar para "cotizaciones pendientes", "pipeline comercial", "embudo de ventas", "cuánto tenemos cotizado", "presupuestos enviados", "oportunidades abiertas".',
  {},
  async (): Promise<ToolResult> => {
    const rows = await selectView<PipelineRow>(
      'gd_pipeline_cotizaciones',
      'select=etiqueta,estado,es_pipeline_abierto,cantidad,monto_nominal_ars,monto_ponderado_ars,probabilidad_promedio_pct,fuera_de_validez&order=orden_embudo.asc&limit=20',
    )
    if (rows.length === 0) return noData('el pipeline de cotizaciones')

    const lines = rows.map((r) => {
      const vencidas =
        Number(r.fuera_de_validez ?? 0) > 0
          ? `, ${formatInteger(r.fuera_de_validez)} fuera de validez`
          : ''
      return `- ${r.etiqueta ?? 'sin estado'}: ${formatInteger(r.cantidad)} cotizaciones por ${formatArsCompact(r.monto_nominal_ars)} (ponderado ${formatArsCompact(r.monto_ponderado_ars)}, probabilidad media ${formatPercent(r.probabilidad_promedio_pct, 0)})${vencidas}`
    })

    // `overview` publishes pipeline abierto as nominal and EXCLUDING borrador.
    // Leading with the same definition makes the two figures identical instead
    // of merely explainable; drafts are reported alongside, not folded in.
    const open = rows.filter((r) => r.es_pipeline_abierto === true)
    const firm = open.filter((r) => r.estado !== 'borrador')
    const drafts = open.filter((r) => r.estado === 'borrador')
    const sumBy = (rs: PipelineRow[], k: 'monto_nominal_ars' | 'monto_ponderado_ars'): number =>
      rs.reduce((a, r) => a + Number(r[k] ?? 0), 0)
    const count = (rs: PipelineRow[]): number =>
      rs.reduce((a, r) => a + Number(r.cantidad ?? 0), 0)
    const draftNote =
      drafts.length === 0
        ? ''
        : ` Aparte hay ${formatInteger(count(drafts))} cotizaciones en borrador por ${formatArsCompact(sumBy(drafts, 'monto_nominal_ars'))}, que no cuentan como pipeline abierto.`
    const header = `Pipeline abierto: ${formatInteger(count(firm))} cotizaciones enviadas o en negociación por ${formatArsCompact(sumBy(firm, 'monto_nominal_ars'))}, equivalentes a ${formatArsCompact(sumBy(firm, 'monto_ponderado_ars'))} ponderados por probabilidad.${draftNote}`
    return text(`${header}\n\n${lines.join('\n')}`)
  },
)

// --- Document expiries -------------------------------------------------------

/** Rows the expiry query will read; one more is fetched to detect truncation. */
const QUERY_CAP = 40

interface DocRow {
  readonly documento: string | null
  readonly documento_tipo: string | null
  readonly entidad_tipo: string | null
  readonly entidad_nombre: string | null
  readonly fecha_vencimiento: string | null
  readonly dias_para_vencer: number | null
  readonly esta_vencido: boolean | null
}

const documentExpiries = tool(
  'document_expiries',
  'DOCUMENTACIÓN únicamente: documentos vencidos o próximos a vencer (habilitaciones, pólizas, certificados), con a qué entidad pertenecen y cuántos días faltan. Usar para "documentos vencidos", "qué documentación se vence", "habilitaciones", "pólizas vencidas", "certificados por vencer", "documentación al día". NO usar para la VTV o el seguro de un vehículo concreto (usar fleet_not_roadworthy), ni para calibraciones de equipos (usar equipment_status), ni para trabajos programados (usar upcoming_agenda).',
  { dias: z.number().int().min(0).max(365).optional() },
  async (args): Promise<ToolResult> => {
    const horizon = args.dias ?? 30
    const rows = await selectView<DocRow>(
      'gd_documentos_vencimientos',
      `select=documento,documento_tipo,entidad_tipo,entidad_nombre,fecha_vencimiento,dias_para_vencer,esta_vencido&dias_para_vencer=lte.${horizon}&order=dias_para_vencer.asc&limit=${QUERY_CAP + 1}`,
    )
    if (rows.length === 0) {
      return text(`No hay documentos vencidos ni por vencer en los próximos ${formatInteger(horizon)} días.`)
    }

    const vencidos = rows.filter((r) => r.esta_vencido === true)
    const lines = rows.slice(0, 20).map((r) => {
      const dias = Number(r.dias_para_vencer ?? 0)
      const plazo = r.esta_vencido === true
        ? `vencido hace ${formatInteger(Math.abs(dias))} días`
        : `vence en ${formatInteger(dias)} días`
      return `- ${r.documento ?? r.documento_tipo ?? 'documento'} — ${r.entidad_nombre ?? 'sin asignar'} (${r.entidad_tipo ?? 'sin tipo'}): ${plazo}`
    })

    // One row beyond the cap is fetched purely to detect truncation: reporting a
    // capped row count as if it were the total would understate the real figure
    // without saying so.
    const truncated = rows.length > QUERY_CAP
    const counted = truncated ? `más de ${formatInteger(QUERY_CAP)}` : formatInteger(rows.length)
    const header = `${counted} documentos requieren atención en ${formatInteger(horizon)} días: al menos ${formatInteger(vencidos.length)} ya vencidos.`
    const more = rows.length > 20 ? `\n\n(se listan los 20 más urgentes)` : ''
    return text(`${header}\n\n${lines.join('\n')}${more}`)
  },
)

// --- Work-order compliance ---------------------------------------------------

interface ComplianceRow {
  readonly dimension: string | null
  readonly dimension_nombre: string | null
  readonly ot_completadas: number | null
  readonly horas_reales_sobre_estimadas_pct: string | number | null
  readonly incidentes_seguridad: number | null
}

const deliveryCompliance = tool(
  'delivery_compliance',
  'Productividad operativa por servicio o por cliente: órdenes de trabajo completadas, desvío de horas reales contra estimadas e incidentes de seguridad. Usar para "desvío de horas", "incidentes de seguridad", "performance operativa", "productividad", "cuántas OT completamos".',
  { dimension: z.enum(['servicio', 'cliente']).optional() },
  async (args): Promise<ToolResult> => {
    const dim = args.dimension ?? 'servicio'
    const rows = await selectView<ComplianceRow>(
      'gd_ot_cumplimiento',
      `select=dimension,dimension_nombre,ot_completadas,horas_reales_sobre_estimadas_pct,incidentes_seguridad&dimension=eq.${dim}&order=ot_completadas.desc&limit=20`,
    )
    if (rows.length === 0) return noData(`el cumplimiento por ${dim}`)

    const lines = rows.map((r) => {
      const inc = Number(r.incidentes_seguridad ?? 0) > 0
        ? `, ${formatInteger(r.incidentes_seguridad)} incidentes de seguridad`
        : ''
      // On-time delivery is deliberately absent: the seed schedules every work
      // order to start on its due date, so `en_fecha` is false by construction
      // and the metric reads 0% everywhere. Restore once the seed is corrected.
      return `- ${r.dimension_nombre ?? 'sin nombre'}: ${formatInteger(r.ot_completadas)} OT completadas, horas reales al ${formatPercent(r.horas_reales_sobre_estimadas_pct, 0)} de lo estimado${inc}`
    })
    return text(`Productividad operativa por ${dim}:\n${lines.join('\n')}`)
  },
)

export const OPERATION_TOOLS = [
  equipmentStatus,
  quotesPipeline,
  documentExpiries,
  deliveryCompliance,
]
