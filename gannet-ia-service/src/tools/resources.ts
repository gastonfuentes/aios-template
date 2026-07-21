/**
 * Resource tools: HR headcount by area and critical-stock articles.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectView } from '../supabase.js'
import { formatInteger, formatQuantity, toNumber } from '../format.js'
import { noData, text, type ToolResult } from './helpers.js'

interface HrRow {
  readonly area: string
  readonly dotacion_activa: number | null
  readonly dotacion_total: number | null
}

const hrHeadcount = tool(
  'hr_headcount',
  'Dotación de personal por área (operaciones, mantenimiento, logística, administración, etc.), con la dotación activa y total, y el total general de empleados. Usar para "cuántos empleados tenemos", "dotación", "personal por área", "headcount".',
  {},
  async (): Promise<ToolResult> => {
    const rows = await selectView<HrRow>(
      'gd_rrhh_resumen',
      'select=area,dotacion_activa,dotacion_total&order=dotacion_activa.desc',
    )
    if (rows.length === 0) return noData('la dotación de personal')
    const totalActiva = rows.reduce((a, r) => a + (toNumber(r.dotacion_activa) ?? 0), 0)
    const totalGeneral = rows.reduce((a, r) => a + (toNumber(r.dotacion_total) ?? 0), 0)
    const lines = rows.map(
      (r) => `- ${r.area}: ${formatInteger(r.dotacion_activa)} activos (${formatInteger(r.dotacion_total)} en total)`,
    )
    return text(
      `Dotación total: ${formatInteger(totalActiva)} empleados activos (${formatInteger(totalGeneral)} incluyendo licencias, suspensiones y bajas).\n\nPor área:\n${lines.join('\n')}`,
    )
  },
)

interface StockRow {
  readonly articulo: string
  readonly deposito: string
  readonly unidad_medida: string | null
  readonly cantidad_actual: string | number | null
  readonly stock_minimo: string | number | null
  readonly faltante: string | number | null
  readonly sin_existencia: boolean | null
}

const stockCritical = tool(
  'stock_critical',
  'Artículos en stock crítico (por debajo del mínimo o sin existencia), por depósito, con la cantidad actual, el mínimo y el faltante. Usar para "qué artículos están en stock crítico", "qué falta en el depósito", "quiebre de stock", "reposición".',
  { top: z.number().int().min(1).max(40).optional() },
  async (args): Promise<ToolResult> => {
    const limit = args.top ?? 12
    const rows = await selectView<StockRow>(
      'gd_stock_critico',
      `select=articulo,deposito,unidad_medida,cantidad_actual,stock_minimo,faltante,sin_existencia&order=faltante.desc&limit=${limit}`,
    )
    if (rows.length === 0) return text('No hay artículos en stock crítico en este momento.')
    const lines = rows.map((r) => {
      const flag = r.sin_existencia ? ' [sin existencia]' : ''
      return `• ${r.articulo} — ${r.deposito}: ${formatQuantity(r.cantidad_actual, r.unidad_medida)} disponibles, mínimo ${formatQuantity(r.stock_minimo, r.unidad_medida)}, faltan ${formatQuantity(r.faltante, r.unidad_medida)}${flag}`
    })
    return text(`Artículos en stock crítico (mayor faltante primero):\n${lines.join('\n')}`)
  },
)

export const RESOURCE_TOOLS = [hrHeadcount, stockCritical]
