/**
 * Deterministic answer builders for the AI screen (`/ia`).
 *
 * Every figure a visitor reads here is produced by the shared `format.ts`
 * formatters — the exact same functions the `/flota` and `/facturacion` screens
 * call. That identity is the whole point of stage 1: the AI's numbers are
 * byte-for-byte what the modules display, because they come from the same views
 * through the same formatters. A builder concatenates already-formatted strings;
 * it never rounds, scales or formats a number by hand.
 *
 * Aggregation (the per-client overdue totals) is done on raw numeric values via
 * `toNumber`, and the single resulting sum is formatted once. Summing formatted
 * strings would be wrong — compacted magnitudes do not add — so the raw-sum,
 * format-last order is deliberate.
 */

import { formatArsCompact, formatDate, formatInteger, toNumber } from '@/features/gannet/format'
import { VEHICLE_TYPE, describe } from '@/features/gannet/labels'
import type { AgingRow, FlotaNoAptoRow } from './queries'

/** Overdue target for the "who do I call first" prompt: $5.000 M. */
const COLLECTION_TARGET_ARS = 5_000_000_000

/** A bucket counts as overdue once it is past the current ("A vencer") tier. */
function isOverdue(row: AgingRow): boolean {
  return (row.orden_tramo ?? 0) >= 2
}

/**
 * Q1 — "¿Qué vehículos no están en condiciones de circular y por qué?"
 *
 * Lists each barred vehicle exactly as `/flota` labels it: humanized type,
 * make, model and the failing reason. The count is derived live, never
 * hardcoded — the fleet's fitness changes as VTV dates roll over.
 */
export function answerFlotaNoApto(rows: FlotaNoAptoRow[]): string {
  if (rows.length === 0) {
    return 'Toda la flota está en condiciones de circular.'
  }

  // `/flota` counts fitness over the ACTIVE fleet only ("35 / 44"): a
  // decommissioned unit (`estado === 'baja'`) is not a compliance failure and is
  // out of the denominator. A visitor subtracting on screen expects the active
  // non-roadworthy count, so we report that first and disclose the baja units
  // separately — the answer then reconciles with the card instead of overcounting.
  const baja = rows.filter((row) => row.estado === 'baja')
  const activos = rows.filter((row) => row.estado !== 'baja')
  const lines = [...activos, ...baja].map(formatVehicleLine)

  return `${buildFlotaHeader(activos.length, baja.length)}\n\n${lines.join('\n')}`
}

/** One bullet: plate, humanized type, make/model and the failing condition. */
function formatVehicleLine(row: FlotaNoAptoRow): string {
  const tipo = describe(VEHICLE_TYPE, row.tipo).label
  const vehicle = [row.marca, row.modelo].filter(Boolean).join(' ')
  const detail = [tipo, vehicle].filter((part) => part && part !== '—').join(' ')
  const motivo = row.motivo_no_apto ?? 'Sin especificar'
  return `• ${row.dominio} — ${detail} · ${motivo}`
}

/** Reconciling header: active non-roadworthy first, decommissioned disclosed apart. */
function buildFlotaHeader(activos: number, baja: number): string {
  const total = activos + baja
  if (baja === 0) {
    return activos === 1
      ? 'Hay 1 vehículo que no está en condiciones de circular:'
      : `Hay ${formatInteger(activos)} vehículos que no están en condiciones de circular:`
  }
  if (activos === 0) {
    return baja === 1
      ? 'Hay 1 vehículo dado de baja, fuera de la flota activa:'
      : `Hay ${formatInteger(baja)} vehículos dados de baja, fuera de la flota activa:`
  }
  const activosText =
    activos === 1
      ? '1 vehículo de la flota activa que no está en condiciones de circular'
      : `${formatInteger(activos)} vehículos de la flota activa que no están en condiciones de circular`
  const bajaText = baja === 1 ? '1 dado de baja' : `${formatInteger(baja)} dados de baja`
  return `Hay ${activosText}, más ${bajaText} (${formatInteger(total)} en total):`
}

/** A client's overdue position, aggregated across their overdue buckets. */
interface OverdueClient {
  readonly cliente: string
  readonly montoArs: number
  readonly facturas: number
  readonly diasVencidoMaximo: number
  readonly vencimientoMasAntiguo: string | null
}

/**
 * Folds the per-bucket aging rows into one overdue position per client, then
 * ranks them by amount. Shared by Q2 (the top debtor) and Q3 (the call list).
 */
function rankOverdueClients(rows: AgingRow[]): OverdueClient[] {
  const byClient = new Map<number, OverdueClient>()

  for (const row of rows) {
    if (!isOverdue(row)) continue
    const monto = toNumber(row.monto_ars) ?? 0
    const facturas = row.facturas ?? 0
    const diasMax = row.dias_vencido_maximo ?? 0
    const previous = byClient.get(row.cliente_id)

    if (previous === undefined) {
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
      previous.vencimientoMasAntiguo === null ||
      (row.vencimiento_mas_antiguo !== null &&
        row.vencimiento_mas_antiguo < previous.vencimientoMasAntiguo)
        ? row.vencimiento_mas_antiguo
        : previous.vencimientoMasAntiguo

    byClient.set(row.cliente_id, {
      cliente: previous.cliente,
      montoArs: previous.montoArs + monto,
      facturas: previous.facturas + facturas,
      diasVencidoMaximo: Math.max(previous.diasVencidoMaximo, diasMax),
      vencimientoMasAntiguo: oldest,
    })
  }

  return [...byClient.values()].sort((a, b) => b.montoArs - a.montoArs)
}

/**
 * Q2 — "¿Qué cliente me debe más plata vencida y desde cuándo?"
 *
 * Reports the largest overdue debtor with its amount, invoice count, oldest due
 * date and peak days overdue — all formatted through the shared formatters.
 */
export function answerTopDebtor(rows: AgingRow[]): string {
  const ranked = rankOverdueClients(rows)
  if (ranked.length === 0) {
    return 'No hay deuda vencida registrada.'
  }

  const top = ranked[0]
  return (
    `El cliente con mayor deuda vencida es ${top.cliente}, ` +
    `con ${formatArsCompact(top.montoArs)} en ${formatInteger(top.facturas)} facturas. ` +
    `La factura vencida más antigua es del ${formatDate(top.vencimientoMasAntiguo)} ` +
    `y la mora máxima llega a ${formatInteger(top.diasVencidoMaximo)} días.`
  )
}

/**
 * Q3 — "Si tengo que cobrar 5 mil millones esta semana, ¿a quién llamo primero?"
 *
 * Walks the overdue ranking from the top and stops at the smallest set of
 * clients whose combined overdue clears the target, framed as a call list.
 */
export function answerCollectionPlan(rows: AgingRow[]): string {
  const ranked = rankOverdueClients(rows)
  if (ranked.length === 0) {
    return 'No hay deuda vencida para priorizar.'
  }

  const selected: OverdueClient[] = []
  let accumulated = 0
  for (const client of ranked) {
    selected.push(client)
    accumulated += client.montoArs
    if (accumulated >= COLLECTION_TARGET_ARS) break
  }

  const lines = selected.map(
    (client, index) =>
      `${index + 1}. ${client.cliente} — ${formatArsCompact(client.montoArs)} vencido`,
  )

  const target = formatArsCompact(COLLECTION_TARGET_ARS)
  const header = `Para cubrir ${target} esta semana, llamá primero a estos ${formatInteger(
    selected.length,
  )} clientes (ordenados por deuda vencida):`

  const cleared = accumulated >= COLLECTION_TARGET_ARS
  const footer = cleared
    ? `Sumados llegan a ${formatArsCompact(accumulated)}, suficiente para cubrir el objetivo.`
    : `Toda la cartera vencida suma ${formatArsCompact(accumulated)}, por debajo del objetivo.`

  return `${header}\n\n${lines.join('\n')}\n\n${footer}`
}
