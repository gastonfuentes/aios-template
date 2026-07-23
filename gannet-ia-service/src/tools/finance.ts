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
import { MAX_PAGE_ROWS, selectPage, selectView } from '../supabase.js'
import { formatArsCompact, formatDate, formatInteger, toNumber } from '../format.js'
import { PURCHASE_ORDER_STATE, label } from '../labels.js'
import { listedNote, noData, partialWarning, text, type ToolResult } from './helpers.js'

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

// Both receivables tools rank the WHOLE portfolio, so a cut page would drop
// debtors and understate the cartera. The page is counted for exactly that
// reason: `page.truncated` is the only way to know the ranking is complete.
const AGING_SELECT =
  'select=cliente_id,cliente,orden_tramo,monto_ars,facturas,dias_vencido_maximo,vencimiento_mas_antiguo&order=orden_tramo.desc&limit=200'

const receivablesOverdue = tool(
  'receivables_overdue',
  'Deuda vencida por cliente, agregada y ordenada de mayor a menor: monto vencido, cantidad de facturas, fecha de la factura vencida más antigua y mora máxima en días. Sirve para el mayor deudor y también como lista de llamados para priorizar cobranzas. Usar para "quién me debe más plata vencida", "a quién llamo primero para cobrar", "cartera vencida".',
  { top: z.number().int().min(1).max(30).optional() },
  async (args): Promise<ToolResult> => {
    const page = await selectPage<AgingRow>('gd_cobranzas_aging', AGING_SELECT)
    const ranked = rankOverdue(page.rows)
    if (ranked.length === 0) return text('No hay deuda vencida registrada.')
    const limited = ranked.slice(0, args.top ?? 8)
    const lines = limited.map(
      (c, i) =>
        `${i + 1}. ${c.cliente}: ${formatArsCompact(c.montoArs)} vencido en ${formatInteger(c.facturas)} facturas; la más antigua vence el ${formatDate(c.vencimientoMasAntiguo)}, mora máxima ${formatInteger(c.diasVencidoMaximo)} días.`,
    )
    const total = ranked.reduce((a, c) => a + c.montoArs, 0)
    const shown = listedNote(limited.length, ranked.length, 'clientes con deuda vencida')
    return text(
      `Deuda vencida por cliente (ordenada de mayor a menor):\n${lines.join('\n')}${shown}\n\nTotal de la cartera vencida: ${formatArsCompact(total)} en ${formatInteger(ranked.length)} clientes.${partialWarning(page, 'tramos de aging')}`,
    )
  },
)

const collectionPlan = tool(
  'collection_plan',
  'Plan de cobranza priorizado: dado un objetivo de cobro (en pesos), devuelve la lista mínima de clientes a llamar, ordenados por deuda vencida, cuya suma acumulada alcanza el objetivo, con el acumulado ya calculado. Usar para "a quién llamo primero para cobrar X", "si tengo que cobrar N esta semana", "priorizar cobranzas para juntar un monto".',
  { objetivo_ars: z.number().positive().optional() },
  async (args): Promise<ToolResult> => {
    const target = args.objetivo_ars ?? 5_000_000_000
    const page = await selectPage<AgingRow>('gd_cobranzas_aging', AGING_SELECT)
    const ranked = rankOverdue(page.rows)
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
    return text(
      `Para cubrir ${formatArsCompact(target)}, llamá primero a estos clientes (ordenados por deuda vencida):\n${lines.join('\n')}\n\n${footer}${partialWarning(page, 'tramos de aging')}`,
    )
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
  readonly oc_canceladas: number | null
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
    // The old `limit=2000` was above PGRST_DB_MAX_ROWS, so PostgREST silently
    // capped it at 1000 anyway: the query asked for a guarantee the server never
    // gave. `MAX_PAGE_ROWS` is that ceiling, and the counted page is what tells
    // us whether the 30-day window actually fits under it.
    const recent = await selectPage<PurchaseOrderRow>(
      'gd_ordenes_compra',
      `select=total_ars&fecha_emision=gte.${cutoff}&limit=${MAX_PAGE_ROWS}`,
    )
    // A declared top 5, like the commercial rankings: the answer says "los
    // principales", never "todos", so no count is needed.
    const suppliers = await selectView<SupplierRow>(
      'gd_compras_por_proveedor',
      'select=proveedor,monto_total_ars,oc_total,oc_canceladas&order=monto_total_ars.desc&limit=5',
    )
    if (recent.rows.length === 0 && suppliers.length === 0) return noData('las compras')
    const recentTotal = recent.rows.reduce((a, r) => a + (toNumber(r.total_ars) ?? 0), 0)
    const recentCount = recent.total ?? recent.rows.length
    // The amount is a sum over the rows that arrived; the count is the server's.
    // If the window overflowed the page the amount is a floor, and says so.
    const monto = recent.truncated
      ? `al menos ${formatArsCompact(recentTotal)}`
      : formatArsCompact(recentTotal)
    // The view sums `monto_total_ars` EXCLUDING cancelled orders but `oc_total`
    // counts them, so pairing the raw count with the amount reads as "$X in N
    // OCs" where N includes orders that never contributed to X. Count the same
    // set the amount describes: total minus cancelled.
    const supplierLines = suppliers.map((s, i) => {
      const vigentes = (toNumber(s.oc_total) ?? 0) - (toNumber(s.oc_canceladas) ?? 0)
      return `${i + 1}. ${s.proveedor}: ${formatArsCompact(s.monto_total_ars)} en ${formatInteger(vigentes)} órdenes de compra`
    })
    return text(
      `Compras de los últimos 30 días: ${monto} en ${formatInteger(recentCount)} órdenes de compra.\n\nPrincipales proveedores por monto histórico:\n${supplierLines.join('\n')}${partialWarning(recent, 'órdenes de compra del período')}`,
    )
  },
)

// --- Overdue invoice detail --------------------------------------------------

interface InvoiceRow {
  readonly numero: string | null
  readonly cliente: string | null
  readonly total_ars: string | number | null
  readonly dias_vencido: number | null
  readonly fecha_vencimiento: string | null
  readonly proyecto: string | null
}

/** Invoices the query reads; the true total always comes from the row count. */
const INVOICE_QUERY_CAP = 60

const overdueInvoices = tool(
  'overdue_invoices',
  'Detalle factura por factura de las facturas vencidas (pendientes de cobro y pasadas de su fecha de vencimiento): número, cliente, monto, días de mora, fecha de vencimiento y proyecto de CADA factura. Ordenable por monto o por mora. Usar para "cuál es la factura vencida más grande", "qué facturas de tal cliente están vencidas", "la factura más morosa", "detalle de facturas vencidas". Para el total de deuda vencida AGREGADA por cliente usar receivables_overdue.',
  {
    top: z.number().int().min(1).max(40).optional(),
    ordenar_por: z.enum(['monto', 'mora']).optional(),
  },
  async (args): Promise<ToolResult> => {
    const order = args.ordenar_por === 'mora' ? 'dias_vencido.desc' : 'total_ars.desc'
    const page = await selectPage<InvoiceRow>(
      'gd_facturas',
      `select=numero,cliente,total_ars,dias_vencido,fecha_vencimiento,proyecto&esta_pendiente=eq.true&dias_vencido=gt.0&order=${order}&limit=${INVOICE_QUERY_CAP}`,
    )
    const rows = page.rows
    if (rows.length === 0) return text('No hay facturas vencidas pendientes de cobro.')

    const shown = rows.slice(0, args.top ?? 10)
    const lines = shown.map((r) => {
      const proyecto = r.proyecto ? ` · ${r.proyecto}` : ''
      return `- ${r.numero ?? 'sin número'} — ${r.cliente ?? 'sin cliente'}: ${formatArsCompact(r.total_ars)} · vencida hace ${formatInteger(r.dias_vencido)} días (venció el ${formatDate(r.fecha_vencimiento)})${proyecto}`
    })
    const total = page.total ?? rows.length
    const criterio = args.ordenar_por === 'mora' ? 'de mayor a menor mora' : 'de mayor a menor monto'
    const header = `${formatInteger(total)} facturas vencidas pendientes de cobro (${criterio}):`
    const note = listedNote(shown.length, total, 'facturas vencidas')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
  },
)

// --- Purchase-order detail ---------------------------------------------------

interface PurchaseOrderDetailRow {
  readonly numero: string | null
  readonly proveedor: string | null
  readonly estado: string | null
  readonly total_ars: string | number | null
  readonly fecha_emision: string | null
  readonly proyecto: string | null
}

/** Purchase orders the query reads; the true total always comes from the row count. */
const PO_QUERY_CAP = 60

/** The states a purchase order can hold — the enum is a promise about the data. */
const PO_STATES = ['borrador', 'enviada', 'aprobada', 'recibida_parcial', 'recibida', 'cancelada'] as const

const purchaseOrdersList = tool(
  'purchase_orders_list',
  'Detalle de órdenes de compra individuales: número, proveedor, estado, monto, fecha de emisión y proyecto de CADA orden. Filtrable por estado. Los estados posibles son borrador, enviada, aprobada, recibida_parcial, recibida y cancelada. Usar para "compras con estado aprobada", "órdenes de compra aprobadas", "qué compras están enviadas / recibidas / canceladas", "detalle de las órdenes de compra", "órdenes de compra de tal estado". Para el total comprado en los últimos 30 días y el ranking de proveedores por monto usar purchasing_summary.',
  {
    estado: z.enum(PO_STATES).optional(),
    top: z.number().int().min(1).max(40).optional(),
  },
  async (args): Promise<ToolResult> => {
    const filter = args.estado !== undefined ? `&estado=eq.${args.estado}` : ''
    const page = await selectPage<PurchaseOrderDetailRow>(
      'gd_ordenes_compra',
      `select=numero,proveedor,estado,total_ars,fecha_emision,proyecto&order=total_ars.desc${filter}&limit=${PO_QUERY_CAP}`,
    )
    const rows = page.rows
    const scope =
      args.estado !== undefined
        ? `órdenes de compra en estado "${label(PURCHASE_ORDER_STATE, args.estado)}"`
        : 'órdenes de compra'
    if (rows.length === 0) return text(`No hay ${scope}.`)

    // The per-line state is redundant when every row shares the filtered state.
    const hideEstado = args.estado !== undefined
    const shown = rows.slice(0, args.top ?? 12)
    const lines = shown.map((r) => {
      const proyecto = r.proyecto ? ` · ${r.proyecto}` : ''
      const est = hideEstado ? '' : ` · ${label(PURCHASE_ORDER_STATE, r.estado)}`
      return `- ${r.numero ?? 'sin número'} — ${r.proveedor ?? 'sin proveedor'}: ${formatArsCompact(r.total_ars)} · emitida ${formatDate(r.fecha_emision)}${est}${proyecto}`
    })
    const total = page.total ?? rows.length
    const header = `${scope.charAt(0).toUpperCase()}${scope.slice(1)}: ${formatInteger(total)} en total, de mayor a menor monto.`
    const note = listedNote(shown.length, total, 'órdenes de compra')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
  },
)

export const FINANCE_TOOLS = [
  receivablesOverdue,
  overdueInvoices,
  collectionPlan,
  purchasingSummary,
  purchaseOrdersList,
]
