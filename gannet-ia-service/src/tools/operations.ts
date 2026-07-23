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
import { countView, selectPage } from '../supabase.js'
import { formatArsCompact, formatDate, formatInteger, formatPercent } from '../format.js'
import {
  DOCUMENT_ENTITY,
  DOCUMENT_TYPE,
  EQUIPMENT_CATEGORY,
  EQUIPMENT_STATE,
  QUOTE_STATE,
  label,
} from '../labels.js'
import { listedNote, noData, partialWarning, text, type ToolResult } from './helpers.js'

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
    // Every figure below is a sum over these rows, so a cut page would understate
    // the whole park. `selectPage` is what makes that detectable.
    const page = await selectPage<EquipmentRow>(
      'gd_equipos_disponibilidad',
      'select=categoria,estado,cantidad,alquilables,calibraciones_vencidas,calibraciones_por_vencer_30d,valor_total_ars&order=cantidad.desc&limit=60',
    )
    const rows = page.rows
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
      // `gd_equipos_disponibilidad` is grouped by (categoria, estado), so a bare
      // category label would print the same category several times with no way to
      // tell the rows apart. The state is part of the label, matching the module
      // grid which shows category and state in separate columns.
      return `- ${label(EQUIPMENT_CATEGORY, r.categoria)} (${label(EQUIPMENT_STATE, r.estado)}): ${formatInteger(r.cantidad)} equipos (${formatInteger(r.alquilables)} alquilables)${cal}`
    })

    const bajaNote = debajas === 0 ? '' : ` (más ${formatInteger(debajas)} dados de baja, no contabilizados)`
    const header = `Parque de equipos: ${formatInteger(sum('cantidad'))} unidades activas${bajaNote}, valor ${formatArsCompact(sum('valor_total_ars'))}.`
    const calib = `Calibraciones: ${formatInteger(vencidas)} vencidas y ${formatInteger(porVencer)} por vencer en 30 días.`
    return text(`${header}\n${calib}\n\n${lines.join('\n')}${partialWarning(page, 'categorías de equipos')}`)
  },
)

// --- Equipment calibration detail --------------------------------------------

interface EquipmentUnitRow {
  readonly codigo_interno: string | null
  readonly equipo: string | null
  readonly categoria: string | null
  readonly estado: string | null
  readonly dias_para_calibracion: number | null
  readonly calibracion_vencida: boolean | null
  readonly responsable: string | null
}

/** Units the query reads; the true total always comes from the row count. */
const CALIBRATION_QUERY_CAP = 60

/** Units spelled out one by one; the rest are covered by the stated total. */
const CALIBRATION_LIST_CAP = 20

const equipmentCalibrationDetail = tool(
  'equipment_calibration_detail',
  'Detalle unidad por unidad de equipos e instrumentos con calibración vencida o próxima a vencer: código interno, equipo, categoría, días para la calibración y responsable de CADA unidad. Sin parámetro lista las que ya están vencidas; con "dias" incluye además las que vencen dentro de ese horizonte. Usar para "qué equipos tienen la calibración vencida", "listame los instrumentos a calibrar", "qué instrumento hay que calibrar y de quién es". Para el resumen agregado del parque por categoría (cantidades y valor) usar equipment_status.',
  { dias: z.number().int().min(0).max(180).optional() },
  async (args): Promise<ToolResult> => {
    // No `dias` → only the units already overdue. With a horizon, `lte` includes
    // the overdue ones (negative days) plus everything due within the window.
    const filter =
      args.dias === undefined
        ? 'calibracion_vencida=is.true'
        : `dias_para_calibracion=lte.${args.dias}`
    const page = await selectPage<EquipmentUnitRow>(
      'gd_equipos',
      `select=codigo_interno,equipo,categoria,estado,dias_para_calibracion,calibracion_vencida,responsable&${filter}&order=dias_para_calibracion.asc&limit=${CALIBRATION_QUERY_CAP}`,
    )
    const rows = page.rows
    const scope =
      args.dias === undefined
        ? 'con la calibración vencida'
        : `con calibración vencida o que vence en ${formatInteger(args.dias)} días`
    if (rows.length === 0) return text(`No hay equipos ${scope}.`)

    const lines = rows.slice(0, CALIBRATION_LIST_CAP).map((r) => {
      const dias = Number(r.dias_para_calibracion ?? 0)
      const plazo =
        r.calibracion_vencida === true || dias < 0
          ? `vencida hace ${formatInteger(Math.abs(dias))} días`
          : `vence en ${formatInteger(dias)} días`
      const resp = r.responsable ? ` · resp. ${r.responsable}` : ''
      return `- ${r.codigo_interno ?? 'sin código'} ${r.equipo ?? ''} (${label(EQUIPMENT_CATEGORY, r.categoria)}): calibración ${plazo}${resp}`
    })
    const total = page.total ?? rows.length
    const header = `${formatInteger(total)} equipos ${scope} (los más urgentes primero):`
    const note = listedNote(lines.length, total, 'equipos')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
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
  'Embudo comercial de cotizaciones por estado: cantidad, monto nominal, monto ponderado por probabilidad y cuántas quedaron fuera de validez. Usar para "cotizaciones pendientes", "pipeline comercial", "embudo de ventas", "cuánto tenemos cotizado", "presupuestos enviados", "oportunidades abiertas". Este es el RESUMEN agregado por estado (totales), no el detalle de cada cotización: para ver cotizaciones individuales con cliente, monto y fecha de validez usar quotes_detail.',
  {},
  async (): Promise<ToolResult> => {
    // The header sums cantidad and both amounts across these rows: a missing
    // funnel stage would quietly shrink the pipeline the demo is selling.
    const page = await selectPage<PipelineRow>(
      'gd_pipeline_cotizaciones',
      'select=etiqueta,estado,es_pipeline_abierto,cantidad,monto_nominal_ars,monto_ponderado_ars,probabilidad_promedio_pct,fuera_de_validez&order=orden_embudo.asc&limit=20',
    )
    const rows = page.rows
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
    return text(`${header}\n\n${lines.join('\n')}${partialWarning(page, 'estados del embudo')}`)
  },
)

// --- Quote detail ------------------------------------------------------------

interface QuoteRow {
  readonly numero: string | null
  readonly estado: string | null
  readonly cliente: string | null
  readonly servicio_principal: string | null
  readonly responsable_comercial: string | null
  readonly fecha_validez: string | null
  readonly fuera_de_validez: boolean | null
  readonly probabilidad_pct: string | number | null
  readonly total_ars: string | number | null
}

/** The state codes accepted as a filter — the enum is a promise about the data. */
const QUOTE_STATES = [
  'borrador',
  'enviada',
  'en_negociacion',
  'aceptada',
  'rechazada',
  'vencida',
] as const

/** Rows the query reads; the true total always comes from the row count. */
const QUOTE_QUERY_CAP = 60

/** Quotes spelled out one by one; the rest are covered by the stated total. */
const QUOTE_LIST_CAP = 15

const quotesDetail = tool(
  'quotes_detail',
  'Detalle de cotizaciones individuales: cliente, monto, estado, fecha de validez, probabilidad y responsable comercial de CADA cotización, con filtros por estado y por si está fuera de validez (superó su fecha de validez). Usar cuando piden ver cotizaciones puntuales: "qué cotización está en negociación y vencida", "detalle de las cotizaciones fuera de validez", "cuáles son las cotizaciones en negociación", "cliente y monto de las cotizaciones aceptadas", "qué cotizaciones se vencieron", "mostrame las cotizaciones vencidas". Para el RESUMEN agregado del embudo por estado (cantidades y montos totales) usar quotes_pipeline; esta herramienta lista cada cotización una por una.',
  {
    estado: z.enum(QUOTE_STATES).optional(),
    solo_fuera_de_validez: z.boolean().optional(),
  },
  async (args): Promise<ToolResult> => {
    const filters: string[] = []
    if (args.estado !== undefined) filters.push(`estado=eq.${args.estado}`)
    if (args.solo_fuera_de_validez === true) filters.push('fuera_de_validez=is.true')
    const filterQuery = filters.length > 0 ? `&${filters.join('&')}` : ''

    // Ordered by amount so the biggest opportunity leads; `total` is the real
    // count behind the filter, which is what the header narrates.
    const page = await selectPage<QuoteRow>(
      'gd_cotizaciones',
      `select=numero,estado,cliente,servicio_principal,responsable_comercial,fecha_validez,fuera_de_validez,probabilidad_pct,total_ars&order=total_ars.desc${filterQuery}&limit=${QUOTE_QUERY_CAP}`,
    )
    const rows = page.rows

    // Describe the filter in words so the header restates exactly what was asked.
    const estadoLabel = args.estado !== undefined ? label(QUOTE_STATE, args.estado) : null
    const scope = [
      estadoLabel ? `en estado "${estadoLabel}"` : null,
      args.solo_fuera_de_validez === true ? 'fuera de validez' : null,
    ]
      .filter(Boolean)
      .join(' y ')
    const what = scope ? `cotizaciones ${scope}` : 'cotizaciones'

    if (rows.length === 0) return text(`No hay ${what}.`)

    const lines = rows.slice(0, QUOTE_LIST_CAP).map((r) => {
      const estado = label(QUOTE_STATE, r.estado)
      const vencida = r.fuera_de_validez === true ? ' (fuera de validez)' : ''
      const resp = r.responsable_comercial ? ` · resp. ${r.responsable_comercial}` : ''
      return `- ${r.numero ?? 'sin número'} — ${r.cliente ?? 'sin cliente'}: ${formatArsCompact(r.total_ars)} · ${estado} · validez ${formatDate(r.fecha_validez)}${vencida} · prob. ${formatPercent(r.probabilidad_pct, 0)}${resp}`
    })

    const total = page.total ?? rows.length
    const header = `${what.charAt(0).toUpperCase()}${what.slice(1)}: ${formatInteger(total)} en total, de mayor a menor monto.`
    const note = listedNote(lines.length, total, 'cotizaciones')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
  },
)

// --- Document expiries -------------------------------------------------------

/** Rows the expiry query will read. The real total comes from the row count. */
const QUERY_CAP = 40

/** Expiries spelled out one by one; the rest are covered by the totals. */
const DOC_LIST_CAP = 20

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
  // The view only carries expiries up to CURRENT_DATE + 90, so a horizon past 90
  // could not add a single document — it would only make the header promise a
  // window the data does not cover. Capped to the view's real reach.
  { dias: z.number().int().min(0).max(90).optional() },
  async (args): Promise<ToolResult> => {
    const horizon = args.dias ?? 30
    const range = `dias_para_vencer=lte.${horizon}`
    const page = await selectPage<DocRow>(
      'gd_documentos_vencimientos',
      `select=documento,documento_tipo,entidad_tipo,entidad_nombre,fecha_vencimiento,dias_para_vencer,esta_vencido&${range}&order=dias_para_vencer.asc&limit=${QUERY_CAP}`,
    )
    const rows = page.rows
    if (rows.length === 0) {
      return text(`No hay documentos vencidos ni por vencer en los próximos ${formatInteger(horizon)} días.`)
    }

    const lines = rows.slice(0, DOC_LIST_CAP).map((r) => {
      const dias = Number(r.dias_para_vencer ?? 0)
      const plazo = r.esta_vencido === true
        ? `vencido hace ${formatInteger(Math.abs(dias))} días`
        : `vence en ${formatInteger(dias)} días`
      const nombre = r.documento ?? label(DOCUMENT_TYPE, r.documento_tipo)
      return `- ${nombre} — ${r.entidad_nombre ?? 'sin asignar'} (${label(DOCUMENT_ENTITY, r.entidad_tipo)}): ${plazo}`
    })

    // This tool used to fetch one row past the cap and report "más de 40" — an
    // honest floor, but still not the number on the dashboard. The row count is
    // now available, so the exact total is what gets narrated. Rows arrive
    // sorted by urgency, so the already-expired ones sit at the head of the page
    // and would be undercounted from `rows` alone once the page fills up; they
    // get their own count for the same reason.
    const total = page.total ?? rows.length
    const vencidos = page.truncated
      ? await countView('gd_documentos_vencimientos', `select=documento&${range}&esta_vencido=is.true`)
      : rows.filter((r) => r.esta_vencido === true).length
    const vencidosNote =
      vencidos === null
        ? `al menos ${formatInteger(rows.filter((r) => r.esta_vencido === true).length)} ya vencidos`
        : `${formatInteger(vencidos)} ya vencidos`
    const header = `${formatInteger(total)} documentos requieren atención en ${formatInteger(horizon)} días: ${vencidosNote}.`
    const note = listedNote(lines.length, total, 'documentos, los más urgentes primero')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
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

/**
 * The dimensions `gd_ot_cumplimiento` actually carries.
 *
 * The enum used to offer `cliente`, which the view has never held: asking for it
 * filtered every row away and the model answered "no tengo ese dato" about
 * productivity data that was sitting right there under `responsable`. An enum is
 * a promise about the data, so it has to match the data.
 */
const COMPLIANCE_DIMENSIONS = ['servicio', 'responsable'] as const

/** Above the widest dimension (`responsable`) and far below `MAX_PAGE_ROWS`. */
const COMPLIANCE_QUERY_CAP = 100

/** Rows spelled out; the rest are covered by the stated total. */
const COMPLIANCE_LIST_CAP = 20

const deliveryCompliance = tool(
  'delivery_compliance',
  'Productividad operativa por línea de servicio o por responsable: órdenes de trabajo completadas, desvío de horas reales contra estimadas e incidentes de seguridad. Usar para "desvío de horas", "incidentes de seguridad", "performance operativa", "productividad", "cuántas OT completamos", "qué responsable completó más OT". Las únicas dimensiones disponibles son servicio y responsable; NO hay apertura por cliente (para clientes usar clients_ranking).',
  { dimension: z.enum(COMPLIANCE_DIMENSIONS).optional() },
  async (args): Promise<ToolResult> => {
    const dim = args.dimension ?? 'servicio'
    const page = await selectPage<ComplianceRow>(
      'gd_ot_cumplimiento',
      `select=dimension,dimension_nombre,ot_completadas,horas_reales_sobre_estimadas_pct,incidentes_seguridad&dimension=eq.${dim}&order=ot_completadas.desc&limit=${COMPLIANCE_QUERY_CAP}`,
    )
    const rows = page.rows
    if (rows.length === 0) return noData(`el cumplimiento por ${dim}`)

    const lines = rows.slice(0, COMPLIANCE_LIST_CAP).map((r) => {
      const inc = Number(r.incidentes_seguridad ?? 0) > 0
        ? `, ${formatInteger(r.incidentes_seguridad)} incidentes de seguridad`
        : ''
      // On-time delivery is deliberately absent: the seed schedules every work
      // order to start on its due date, so `en_fecha` is false by construction
      // and the metric reads 0% everywhere. Restore once the seed is corrected.
      return `- ${r.dimension_nombre ?? 'sin nombre'}: ${formatInteger(r.ot_completadas)} OT completadas, horas reales al ${formatPercent(r.horas_reales_sobre_estimadas_pct, 0)} de lo estimado${inc}`
    })
    const total = page.total ?? rows.length
    const unidad = dim === 'servicio' ? 'líneas de servicio' : 'responsables'
    const header = `Productividad operativa por ${dim} (${formatInteger(total)} ${unidad}, de mayor a menor OT completadas):`
    const note = listedNote(lines.length, total, unidad)
    return text(`${header}\n${lines.join('\n')}${note}${partialWarning(page, unidad)}`)
  },
)

export const OPERATION_TOOLS = [
  equipmentStatus,
  equipmentCalibrationDetail,
  quotesPipeline,
  quotesDetail,
  documentExpiries,
  deliveryCompliance,
]
