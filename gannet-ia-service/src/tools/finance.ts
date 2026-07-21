/**
 * Finance tools: receivables aging (who owes the most overdue, and a collection
 * call-list) and purchasing (recent buying and top suppliers).
 *
 * The per-client overdue totals are aggregated inside the tool from raw numeric
 * values and formatted once, mirroring stage 1's raw-sum / format-last order.
 * The model never sums formatted magnitudes; it reads the ranked list as given.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectView } from '../supabase.js'
import { formatArsCompact, formatDate, formatInteger, toNumber } from '../format.js'
import { noData, text, type ToolResult } from './helpers.js'

interface AgingRow {
  readonly cliente_id: number
  readonly cliente: string
  readonly orden_tramo: number | null
  readonly monto_ars: string | number | null
  readonly facturas: number | null
  readonly dias_vencido_maximo: number | null
  readonly vencimiento_mas_antiguo: string | null
}

interface OverdueClient {
  cliente: string
  montoArs: number
  facturas: number
  diasVencidoMaximo: number
  vencimientoMasAntiguo: string | null
}

/** A bucket counts as overdue once it is past the current ("A vencer") tier. */
function isOverdue(row: AgingRow): boolean {
  return (toNumber(row.orden_tramo) ?? 0) >= 2
}

function rankOverdue(rows: readonly AgingRow[]): OverdueClient[] {
  const byClient = new Map<number, OverdueClient>()
  for (const row of rows) {
    if (!isOverdue(row)) continue
    const prev = byClient.get(row.cliente_id)
    const monto = toNumber(row.monto_ars) ?? 0
    const facturas = toNumber(row.facturas) ?? 0
    const diasMax = toNumber(row.dias_vencido_maximo) ?? 0
    if (prev === undefined) {
      byClient.set(row.cliente_id, {
        cliente: row.cliente,
        montoArs: monto,
        facturas,
        diasVencidoMaximo: diasMax,
        vencimientoMasAntiguo: row.vencimiento_mas_antiguo,
      })
      continue
    }
    const oldest =
      prev.vencimientoMasAntiguo === null ||
      (row.vencimiento_mas_antiguo !== null && row.vencimiento_mas_antiguo < prev.vencimientoMasAntiguo)
        ? row.vencimiento_mas_antiguo
        : prev.vencimientoMasAntiguo
    prev.montoArs += monto
    prev.facturas += facturas
    prev.diasVencidoMaximo = Math.max(prev.diasVencidoMaximo, diasMax)
    prev.vencimientoMasAntiguo = oldest
  }
  return [...byClient.values()].sort((a, b) => b.montoArs - a.montoArs)
}

const AGING_SELECT =
  'select=cliente_id,cliente,orden_tramo,monto_ars,facturas,dias_vencido_maximo,vencimiento_mas_antiguo&order=orden_tramo.desc&limit=200'

const receivablesOverdue = tool(
  'receivables_overdue',
  'Deuda vencida por cliente, agregada y ordenada de mayor a menor: monto vencido, cantidad de facturas, fecha de la factura vencida más antigua y mora máxima en días. Sirve para el mayor deudor y también como lista de llamados para priorizar cobranzas. Usar para "quién me debe más plata vencida", "a quién llamo primero para cobrar", "cartera vencida".',
  { top: z.number().int().min(1).max(30).optional() },
  async (args): Promise<ToolResult> => {
    const rows = await selectView<AgingRow>('gd_cobranzas_aging', AGING_SELECT)
    const ranked = rankOverdue(rows)
    if (ranked.length === 0) return text('No hay deuda vencida registrada.')
    const limited = ranked.slice(0, args.top ?? 8)
    const lines = limited.map(
      (c, i) =>
        `${i + 1}. ${c.cliente}: ${formatArsCompact(c.montoArs)} vencido en ${formatInteger(c.facturas)} facturas; la más antigua vence el ${formatDate(c.vencimientoMasAntiguo)}, mora máxima ${formatInteger(c.diasVencidoMaximo)} días.`,
    )
    const total = ranked.reduce((a, c) => a + c.montoArs, 0)
    return text(
      `Deuda vencida por cliente (ordenada de mayor a menor):\n${lines.join('\n')}\n\nTotal de la cartera vencida: ${formatArsCompact(total)} en ${formatInteger(ranked.length)} clientes.`,
    )
  },
)

const collectionPlan = tool(
  'collection_plan',
  'Plan de cobranza priorizado: dado un objetivo de cobro (en pesos), devuelve la lista mínima de clientes a llamar, ordenados por deuda vencida, cuya suma acumulada alcanza el objetivo, con el acumulado ya calculado. Usar para "a quién llamo primero para cobrar X", "si tengo que cobrar N esta semana", "priorizar cobranzas para juntar un monto".',
  { objetivo_ars: z.number().positive().optional() },
  async (args): Promise<ToolResult> => {
    const target = args.objetivo_ars ?? 5_000_000_000
    const rows = await selectView<AgingRow>('gd_cobranzas_aging', AGING_SELECT)
    const ranked = rankOverdue(rows)
    if (ranked.length === 0) return text('No hay deuda vencida para priorizar.')
    const selected: OverdueClient[] = []
    let accumulated = 0
    for (const client of ranked) {
      selected.push(client)
      accumulated += client.montoArs
      if (accumulated >= target) break
    }
    const lines = selected.map(
      (c, i) => `${i + 1}. ${c.cliente}: ${formatArsCompact(c.montoArs)} vencido (acumulado ${formatArsCompact(cumulativeAt(selected, i))}); mora máxima ${formatInteger(c.diasVencidoMaximo)} días.`,
    )
    const cleared = accumulated >= target
    const footer = cleared
      ? `Con estos ${formatInteger(selected.length)} clientes el acumulado llega a ${formatArsCompact(accumulated)}, suficiente para cubrir el objetivo de ${formatArsCompact(target)}.`
      : `Toda la cartera vencida suma ${formatArsCompact(accumulated)}, por debajo del objetivo de ${formatArsCompact(target)}.`
    return text(`Para cubrir ${formatArsCompact(target)}, llamá primero a estos clientes (ordenados por deuda vencida):\n${lines.join('\n')}\n\n${footer}`)
  },
)

/** Running total of overdue amounts through index `i` (inclusive). */
function cumulativeAt(clients: readonly OverdueClient[], i: number): number {
  let sum = 0
  for (let k = 0; k <= i; k += 1) sum += clients[k]?.montoArs ?? 0
  return sum
}

interface PurchaseOrderRow {
  readonly total_ars: string | number | null
}

interface SupplierRow {
  readonly proveedor: string
  readonly monto_total_ars: string | number | null
  readonly oc_total: number | null
}

function cutoffDate(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

const purchasingSummary = tool(
  'purchasing_summary',
  'Compras y proveedores: monto total comprado en los últimos 30 días con la cantidad de órdenes de compra, y el ranking de proveedores por monto histórico. Usar para "cuánto compramos el último mes", "quiénes son los principales proveedores", "gasto en compras".',
  {},
  async (): Promise<ToolResult> => {
    const cutoff = cutoffDate(30)
    const recent = await selectView<PurchaseOrderRow>(
      'gd_ordenes_compra',
      `select=total_ars&fecha_emision=gte.${cutoff}&limit=2000`,
    )
    const suppliers = await selectView<SupplierRow>(
      'gd_compras_por_proveedor',
      'select=proveedor,monto_total_ars,oc_total&order=monto_total_ars.desc&limit=5',
    )
    if (recent.length === 0 && suppliers.length === 0) return noData('las compras')
    const recentTotal = recent.reduce((a, r) => a + (toNumber(r.total_ars) ?? 0), 0)
    const supplierLines = suppliers.map(
      (s, i) => `${i + 1}. ${s.proveedor}: ${formatArsCompact(s.monto_total_ars)} en ${formatInteger(s.oc_total)} órdenes de compra`,
    )
    return text(
      `Compras de los últimos 30 días: ${formatArsCompact(recentTotal)} en ${formatInteger(recent.length)} órdenes de compra.\n\nPrincipales proveedores por monto histórico:\n${supplierLines.join('\n')}`,
    )
  },
)

export const FINANCE_TOOLS = [receivablesOverdue, collectionPlan, purchasingSummary]
