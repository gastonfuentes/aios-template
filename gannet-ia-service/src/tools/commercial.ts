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
  readonly estado: string | null
  readonly monto_contrato_ars: string | number | null
  readonly avance_pct: string | number | null
}

/** Sort key → PostgREST `order` clause. Fixed set; no user string is interpolated. */
const PROJECT_ORDERS = {
  monto: 'monto_contrato_ars.desc',
  avance: 'avance_pct.desc',
} as const

const ORDER_LABEL = {
  monto: 'monto de contrato',
  avance: 'avance físico',
} as const

const projectsRanking = tool(
  'projects_ranking',
  'Ranking de proyectos con cliente, estado, monto de contrato y avance físico. Ordenable por monto o por avance. Usar para "cuál es el proyecto más grande", "proyectos de mayor monto", "qué proyectos tienen más avance", "obras más avanzadas", "proyectos más adelantados", "avance de obra".',
  {
    top: z.number().int().min(1).max(30).optional(),
    ordenar_por: z.enum(['monto', 'avance']).optional(),
    /**
     * Defaults to true when ordering by progress: a finished project sits at
     * 100%, so "the most advanced projects" would otherwise return completed
     * work — technically right and useless to someone asking what is close to
     * delivery. Set false only when finished projects are explicitly wanted.
     */
    solo_en_curso: z.boolean().optional(),
  },
  async (args): Promise<ToolResult> => {
    const limit = args.top ?? 8
    const orderKey = args.ordenar_por ?? 'monto'
    const onlyOngoing = args.solo_en_curso ?? orderKey === 'avance'
    const filter = onlyOngoing ? '&estado=eq.en_curso' : ''
    const rows = await selectView<ProjectRow>(
      'gd_margen_por_proyecto',
      `select=proyecto,cliente,estado,monto_contrato_ars,avance_pct&order=${PROJECT_ORDERS[orderKey]}${filter}&limit=${limit}`,
    )
    if (rows.length === 0) return noData('el ranking de proyectos')
    const lines = rows.map(
      // Margin is deliberately absent: purchase-order amounts are out of scale
      // with contract values, so margen_real_pct currently reads in the
      // thousands of percent. Restore this column once that data is corrected.
      (r, i) => `${i + 1}. ${r.proyecto} (${r.cliente}): avance ${formatPercent(r.avance_pct, 0)}, contrato ${formatArsCompact(r.monto_contrato_ars)}${onlyOngoing ? '' : ` — ${r.estado ?? 'sin estado'}`}`,
    )
    const scope = onlyOngoing ? 'Proyectos en curso' : 'Proyectos'
    return text(`${scope} por ${ORDER_LABEL[orderKey]} (mayor primero):\n${lines.join('\n')}`)
  },
)

export const COMMERCIAL_TOOLS = [clientsRanking, projectsRanking]
