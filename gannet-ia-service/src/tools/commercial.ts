/**
 * Commercial tools: client ranking (by billing) and project ranking (by contract
 * value, with execution progress and real margin).
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectView } from '../supabase.js'
import { formatArsCompact, formatPercent } from '../format.js'
import { noData, text, type ToolResult } from './helpers.js'

interface ClientRankRow {
  readonly cliente: string
  readonly facturado_total_ars: string | number | null
  readonly saldo_vencido_ars: string | number | null
  readonly posicion: number | null
}

const clientsRanking = tool(
  'clients_ranking',
  'Ranking de clientes por facturación total, con el saldo vencido de cada uno. Usar para "cuál es el cliente más grande", "quién factura más", "principales clientes", "ranking de clientes".',
  { top: z.number().int().min(1).max(30).optional() },
  async (args): Promise<ToolResult> => {
    const limit = args.top ?? 8
    const rows = await selectView<ClientRankRow>(
      'gd_ranking_clientes',
      `select=cliente,facturado_total_ars,saldo_vencido_ars,posicion&order=posicion.asc&limit=${limit}`,
    )
    if (rows.length === 0) return noData('el ranking de clientes')
    const lines = rows.map(
      (r) => `${r.posicion}. ${r.cliente}: ${formatArsCompact(r.facturado_total_ars)} facturado (saldo vencido: ${formatArsCompact(r.saldo_vencido_ars)})`,
    )
    return text(`Ranking de clientes por facturación total:\n${lines.join('\n')}`)
  },
)

interface ProjectRow {
  readonly proyecto: string
  readonly cliente: string
  readonly monto_contrato_ars: string | number | null
  readonly avance_pct: string | number | null
  readonly margen_real_pct: string | number | null
}

const projectsRanking = tool(
  'projects_ranking',
  'Ranking de proyectos por monto de contrato, con el cliente, el avance de ejecución y el margen real. Usar para "cuál es el proyecto más grande", "proyectos de mayor monto", "avance de proyectos", "margen de proyectos".',
  { top: z.number().int().min(1).max(30).optional() },
  async (args): Promise<ToolResult> => {
    const limit = args.top ?? 8
    const rows = await selectView<ProjectRow>(
      'gd_margen_por_proyecto',
      `select=proyecto,cliente,monto_contrato_ars,avance_pct,margen_real_pct&order=monto_contrato_ars.desc&limit=${limit}`,
    )
    if (rows.length === 0) return noData('el ranking de proyectos')
    const lines = rows.map(
      (r, i) => `${i + 1}. ${r.proyecto} (${r.cliente}): contrato ${formatArsCompact(r.monto_contrato_ars)}, avance ${formatPercent(r.avance_pct, 0)}, margen real ${formatPercent(r.margen_real_pct)}`,
    )
    return text(`Proyectos por monto de contrato (mayor primero):\n${lines.join('\n')}`)
  },
)

export const COMMERCIAL_TOOLS = [clientsRanking, projectsRanking]
