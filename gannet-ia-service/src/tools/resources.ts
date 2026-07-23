/**
 * Resource tools: HR headcount by area and critical-stock articles.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { MAX_PAGE_ROWS, selectPage } from '../supabase.js'
import { formatInteger, formatQuantity, toNumber } from '../format.js'
import { ARTICLE_CATEGORY, EMPLOYEE_AREA, label } from '../labels.js'
import { listedNote, noData, partialWarning, text, type ToolResult } from './helpers.js'

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
    // The headline headcount is a sum over these rows, so a missing area would
    // shrink the whole company. The limit is explicit rather than left to
    // PostgREST's own ceiling, and the page is counted so a cut is detectable.
    const page = await selectPage<HrRow>(
      'gd_rrhh_resumen',
      'select=area,dotacion_activa,dotacion_total&order=dotacion_activa.desc&limit=100',
    )
    const rows = page.rows
    if (rows.length === 0) return noData('la dotación de personal')
    const totalActiva = rows.reduce((a, r) => a + (toNumber(r.dotacion_activa) ?? 0), 0)
    const totalGeneral = rows.reduce((a, r) => a + (toNumber(r.dotacion_total) ?? 0), 0)
    const lines = rows.map(
      (r) => `- ${label(EMPLOYEE_AREA, r.area)}: ${formatInteger(r.dotacion_activa)} activos (${formatInteger(r.dotacion_total)} en total)`,
    )
    return text(
      `Dotación total: ${formatInteger(totalActiva)} empleados activos (${formatInteger(totalGeneral)} incluyendo licencias, suspensiones y bajas).\n\nPor área:\n${lines.join('\n')}${partialWarning(page, 'áreas')}`,
    )
  },
)

interface StockRow {
  readonly articulo_id: number | null
  readonly articulo: string
  readonly articulo_categoria: string | null
  readonly deposito: string
  readonly unidad_medida: string | null
  readonly cantidad_actual: string | number | null
  readonly stock_minimo: string | number | null
  readonly faltante: string | number | null
  readonly sin_existencia: boolean | null
}

/** The categories an article can hold — the enum is a promise about the data. */
const ARTICLE_CATEGORIES = [
  'combustible',
  'consumible',
  'electrico',
  'epp',
  'ferreteria',
  'lubricante',
  'papeleria',
  'quimico',
  'repuesto',
] as const

const stockCritical = tool(
  'stock_critical',
  'Artículos en stock crítico (por debajo del mínimo o sin existencia), por depósito, con la cantidad actual, el mínimo y el faltante. Devuelve cuántos artículos críticos hay en total y lista los de mayor faltante. Filtrable por categoría de artículo (combustible, consumible, electrico, epp, ferreteria, lubricante, papeleria, quimico, repuesto). Usar para "qué artículos están en stock crítico", "qué falta en el depósito", "quiebre de stock", "reposición", "cuántos artículos en quiebre", y para pedidos con categoría: "artículos químicos en bajo mínimo", "repuestos en quiebre de stock", "qué lubricantes faltan".',
  {
    top: z.number().int().min(1).max(40).optional(),
    categoria: z.enum(ARTICLE_CATEGORIES).optional(),
  },
  async (args): Promise<ToolResult> => {
    const filter = args.categoria !== undefined ? `&articulo_categoria=eq.${args.categoria}` : ''
    // Read every matching record: `gd_stock_critico` holds one row per (artículo,
    // depósito) and is small, so reading it whole lets the answer count DISTINCT
    // articles — the same unit the catalog screen shows. A record count would say
    // "4 artículos" for one article short on two depósitos plus another on two
    // more, when the catalog filtered to those same criteria shows 2.
    const page = await selectPage<StockRow>(
      'gd_stock_critico',
      `select=articulo_id,articulo,articulo_categoria,deposito,unidad_medida,cantidad_actual,stock_minimo,faltante,sin_existencia&order=faltante.desc${filter}&limit=${MAX_PAGE_ROWS}`,
    )
    const rows = page.rows
    const scope =
      args.categoria !== undefined
        ? `artículos de categoría ${label(ARTICLE_CATEGORY, args.categoria)} en stock crítico`
        : 'artículos en stock crítico'
    if (rows.length === 0) return text(`No hay ${scope} en este momento.`)

    // Group by article, keeping the faltante.desc order of first appearance so
    // the article with the single worst shortage leads. One bullet per article,
    // its depósitos listed underneath — never the same article twice.
    const byArticulo = new Map<number, StockRow[]>()
    for (const r of rows) {
      const key = r.articulo_id ?? -1
      const group = byArticulo.get(key)
      if (group === undefined) byArticulo.set(key, [r])
      else group.push(r)
    }
    const groups = [...byArticulo.values()]
    const shown = groups.slice(0, args.top ?? 12)
    const lines = shown.map((group) => {
      const nombre = group[0]?.articulo ?? 'sin nombre'
      const ubicaciones = group.map((r) => {
        const flag = r.sin_existencia ? ' [sin existencia]' : ''
        return `   · ${r.deposito}: ${formatQuantity(r.cantidad_actual, r.unidad_medida)} disponibles, mínimo ${formatQuantity(r.stock_minimo, r.unidad_medida)}, faltan ${formatQuantity(r.faltante, r.unidad_medida)}${flag}`
      })
      return `- ${nombre}\n${ubicaciones.join('\n')}`
    })

    const totalArticulos = byArticulo.size
    const totalRegistros = page.total ?? rows.length
    const ubicNote =
      totalRegistros === totalArticulos
        ? ''
        : ` (en ${formatInteger(totalRegistros)} ubicaciones de depósito)`
    const header = `Hay ${formatInteger(totalArticulos)} ${scope}${ubicNote}, de mayor a menor faltante:`
    const note = listedNote(shown.length, totalArticulos, 'artículos críticos')
    return text(`${header}\n\n${lines.join('\n\n')}${note}`)
  },
)

export const RESOURCE_TOOLS = [hrHeadcount, stockCritical]
