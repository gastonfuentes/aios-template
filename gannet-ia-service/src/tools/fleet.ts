/**
 * Fleet tools: overall roadworthiness, the list of non-roadworthy units and the
 * per-vehicle record looked up by plate.
 *
 * The reconciliation nuance from stage 1 is preserved: `/flota` counts fitness
 * over the ACTIVE fleet only ("35 / 44"), so a decommissioned unit (`estado ===
 * 'baja'`) is out of the denominator. The non-roadworthy list reports the active
 * count first and discloses `baja` units separately, so the answer reconciles
 * with the fleet card instead of overcounting.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectOne, selectPage, selectView, type ViewPage } from '../supabase.js'
import { formatDate, formatInteger } from '../format.js'
import { VEHICLE_STATE, VEHICLE_TYPE, label } from '../labels.js'
import { noData, partialWarning, text, type ToolResult } from './helpers.js'

interface FleetKpiRow {
  readonly flota_operativa: number | null
  readonly flota_apta_circular: number | null
  readonly flota_total: number | null
}

const fleetStatus = tool(
  'fleet_status',
  'Estado general de la flota de vehículos: cantidad operativa, cantidad apta para circular y total de la flota activa (el denominador excluye las unidades dadas de baja). Usar para "cómo está la flota", "cuántos vehículos aptos", "flota operativa".',
  {},
  async (): Promise<ToolResult> => {
    const k = await selectOne<FleetKpiRow>(
      'gd_kpi_ejecutivo',
      'select=flota_operativa,flota_apta_circular,flota_total',
    )
    if (k === null) return noData('el estado de la flota')
    return text(
      `Estado de la flota activa: ${formatInteger(k.flota_apta_circular)} de ${formatInteger(k.flota_total)} vehículos están en condiciones de circular; ${formatInteger(k.flota_operativa)} están operativos. El total corresponde a la flota activa (las unidades dadas de baja quedan fuera de este conteo).`,
    )
  },
)

interface FleetNoAptoRow {
  readonly dominio: string
  readonly tipo: string | null
  readonly marca: string | null
  readonly modelo: string | null
  readonly motivo_no_apto: string | null
  readonly estado: string | null
  readonly responsable: string | null
}

/** `tipo marca modelo`, skipping the parts the view left empty. */
function describeVehicle(row: {
  readonly tipo: string | null
  readonly marca: string | null
  readonly modelo: string | null
}): string {
  const vehicle = [row.marca, row.modelo].filter(Boolean).join(' ')
  const tipo = row.tipo ? label(VEHICLE_TYPE, row.tipo) : ''
  return [tipo, vehicle].filter((p) => p && p !== '—').join(' ')
}

function formatVehicleLine(row: FleetNoAptoRow): string {
  const motivo = row.motivo_no_apto ?? 'Sin especificar'
  const responsable = row.responsable === null ? '' : ` · responsable ${row.responsable}`
  return `• ${row.dominio} — ${describeVehicle(row)} · ${motivo}${responsable}`
}

function renderNoApto(page: ViewPage<FleetNoAptoRow>): string {
  const rows = page.rows
  const baja = rows.filter((r) => r.estado === 'baja')
  const activos = rows.filter((r) => r.estado !== 'baja')
  const lines = [...activos, ...baja].map(formatVehicleLine)
  const header =
    baja.length === 0
      ? `Hay ${formatInteger(activos.length)} vehículos que no están en condiciones de circular:`
      : `Hay ${formatInteger(activos.length)} vehículos de la flota activa que no están en condiciones de circular, más ${formatInteger(baja.length)} dado(s) de baja (fuera de la flota activa):`
  // Both counts are splits of the page, so a cut page would understate them.
  return `${header}\n\n${lines.join('\n')}${partialWarning(page, 'vehículos no aptos')}`
}

const fleetNotRoadworthy = tool(
  'fleet_not_roadworthy',
  'Lista de vehículos que NO están en condiciones de circular, con el motivo (VTV vencida, seguro vencido, dado de baja, etc.). Separa las unidades activas de las dadas de baja para reconciliar con la tarjeta de flota. Usar para "qué vehículos no pueden circular", "vehículos con VTV vencida", "por qué un vehículo no es apto".',
  {},
  async (): Promise<ToolResult> => {
    const page = await selectPage<FleetNoAptoRow>(
      'gd_flota_estado',
      'select=dominio,tipo,marca,modelo,motivo_no_apto,estado,responsable&apto_circular=eq.false&order=estado.asc,dominio.asc&limit=100',
    )
    if (page.rows.length === 0) return text('Toda la flota activa está en condiciones de circular.')
    return text(renderNoApto(page))
  },
)

// --- Vehicle detail by plate -------------------------------------------------

/** Vehicles a partial-plate lookup spells out before it asks for a full plate. */
const PLATE_MATCH_CAP = 5

interface FleetVehicleRow {
  readonly dominio: string
  readonly tipo: string | null
  readonly marca: string | null
  readonly modelo: string | null
  readonly estado: string | null
  readonly responsable: string | null
  readonly responsable_area: string | null
  readonly km_actual: string | number | null
  readonly vtv_vence_el: string | null
  readonly seguro_vence_el: string | null
  readonly apto_circular: boolean | null
  readonly motivo_no_apto: string | null
}

function formatVehicleDetail(row: FleetVehicleRow): string {
  const area = row.responsable_area === null ? '' : ` (${row.responsable_area})`
  const responsable =
    row.responsable === null ? 'sin responsable asignado' : `${row.responsable}${area}`
  const aptitud =
    row.apto_circular === true
      ? 'en condiciones de circular'
      : `NO está en condiciones de circular · ${row.motivo_no_apto ?? 'sin especificar'}`
  return [
    `${row.dominio} — ${describeVehicle(row)}`,
    `- Responsable: ${responsable}`,
    `- Estado: ${label(VEHICLE_STATE, row.estado)} · ${aptitud}`,
    `- Kilometraje: ${formatInteger(row.km_actual)} km`,
    `- VTV vence el ${formatDate(row.vtv_vence_el)} · seguro vence el ${formatDate(row.seguro_vence_el)}`,
  ].join('\n')
}

const fleetVehicleDetail = tool(
  'fleet_vehicle_detail',
  'Ficha de un vehículo puntual buscado por su dominio o patente: quién es el responsable asignado y de qué área, tipo, marca, modelo, estado, kilometraje, vencimiento de VTV y de seguro, y si está en condiciones de circular. Usar para "quién es el responsable del vehículo AB123CD", "a quién está asignada la patente X", "de quién es el dominio X", "datos del vehículo X", "qué pasa con la unidad X".',
  { dominio: z.string().trim().min(2).max(20) },
  async (args): Promise<ToolResult> => {
    // The plate is a filter value, not raw SQL: it is length-bounded and
    // percent-encoded into a PostgREST `ilike`, which is a value comparison.
    // Partial plates are allowed on purpose — a presenter may say only part of
    // it — so several rows can come back and every match is shown.
    const page = await selectPage<FleetVehicleRow>(
      'gd_flota_estado',
      `select=dominio,tipo,marca,modelo,estado,responsable,responsable_area,km_actual,vtv_vence_el,seguro_vence_el,apto_circular,motivo_no_apto&dominio=ilike.*${encodeURIComponent(args.dominio)}*&order=dominio.asc&limit=${PLATE_MATCH_CAP}`,
    )
    const rows = page.rows
    // "Not found" is a real answer here, not missing data: the plate simply is
    // not in the fleet. Say so explicitly so the model does not present it as a
    // gap in the system nor guess a responsible party.
    if (rows.length === 0) {
      return text(`No hay ningún vehículo con dominio ${args.dominio} en la flota.`)
    }
    const blocks = rows.map(formatVehicleDetail)
    if (rows.length === 1) return text(blocks.join('\n\n'))
    // A short fragment can match more units than the page carries, and "hay 5
    // vehículos" would then be the cap talking, not the fleet.
    const total = page.total ?? rows.length
    const shown = page.truncated
      ? `Hay ${formatInteger(total)} vehículos cuyo dominio coincide con ${args.dominio}; se muestran los primeros ${formatInteger(rows.length)}. Dame el dominio completo para acotar.`
      : `Hay ${formatInteger(total)} vehículos cuyo dominio coincide con ${args.dominio}:`
    return text(`${shown}\n\n${blocks.join('\n\n')}`)
  },
)

export const FLEET_TOOLS = [fleetStatus, fleetNotRoadworthy, fleetVehicleDetail]
