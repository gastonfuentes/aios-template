/**
 * Fleet tools: overall roadworthiness and the list of non-roadworthy units.
 *
 * The reconciliation nuance from stage 1 is preserved: `/flota` counts fitness
 * over the ACTIVE fleet only ("35 / 44"), so a decommissioned unit (`estado ===
 * 'baja'`) is out of the denominator. The non-roadworthy list reports the active
 * count first and discloses `baja` units separately, so the answer reconciles
 * with the fleet card instead of overcounting.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { selectOne, selectView } from '../supabase.js'
import { formatInteger } from '../format.js'
import { noData, text, type ToolResult } from './helpers.js'

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
}

function formatVehicleLine(row: FleetNoAptoRow): string {
  const vehicle = [row.marca, row.modelo].filter(Boolean).join(' ')
  const tipo = row.tipo ? row.tipo.replace(/_/g, ' ') : ''
  const detail = [tipo, vehicle].filter((p) => p && p !== '—').join(' ')
  const motivo = row.motivo_no_apto ?? 'Sin especificar'
  return `• ${row.dominio} — ${detail} · ${motivo}`
}

function renderNoApto(rows: readonly FleetNoAptoRow[]): string {
  const baja = rows.filter((r) => r.estado === 'baja')
  const activos = rows.filter((r) => r.estado !== 'baja')
  const lines = [...activos, ...baja].map(formatVehicleLine)
  const header =
    baja.length === 0
      ? `Hay ${formatInteger(activos.length)} vehículos que no están en condiciones de circular:`
      : `Hay ${formatInteger(activos.length)} vehículos de la flota activa que no están en condiciones de circular, más ${formatInteger(baja.length)} dado(s) de baja (fuera de la flota activa):`
  return `${header}\n\n${lines.join('\n')}`
}

const fleetNotRoadworthy = tool(
  'fleet_not_roadworthy',
  'Lista de vehículos que NO están en condiciones de circular, con el motivo (VTV vencida, seguro vencido, dado de baja, etc.). Separa las unidades activas de las dadas de baja para reconciliar con la tarjeta de flota. Usar para "qué vehículos no pueden circular", "vehículos con VTV vencida", "por qué un vehículo no es apto".',
  {},
  async (): Promise<ToolResult> => {
    const rows = await selectView<FleetNoAptoRow>(
      'gd_flota_estado',
      'select=dominio,tipo,marca,modelo,motivo_no_apto,estado&apto_circular=eq.false&order=estado.asc,dominio.asc&limit=100',
    )
    if (rows.length === 0) return text('Toda la flota activa está en condiciones de circular.')
    return text(renderNoApto(rows))
  },
)

export const FLEET_TOOLS = [fleetStatus, fleetNotRoadworthy]
