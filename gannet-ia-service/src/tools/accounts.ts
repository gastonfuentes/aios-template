/**
 * Account-side tools: mining sites, client contacts, the upcoming agenda and the
 * fleet broken down by vehicle type.
 *
 * A prospect at the stand asks about presence ("do you work in my province?"),
 * relationships ("who do you deal with there?") and what is coming next. Those
 * are the questions that turn a metrics demo into a conversation.
 *
 * Same contract as every other tool here: a read-only `GET` against a fixed
 * `gd_*` view, with only validated values ever reaching the query string.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { selectView } from '../supabase.js'
import { formatArsCompact, formatInteger } from '../format.js'
import { noData, text, type ToolResult } from './helpers.js'

// --- Mining sites ------------------------------------------------------------

interface SiteRow {
  readonly faena: string | null
  readonly tipo: string | null
  readonly provincia: string | null
  readonly altitud_msnm: number | null
  readonly cliente: string | null
  readonly mineral_principal: string | null
  readonly proyectos: number | null
  readonly ot_abiertas: number | null
  readonly personal_mes: number | null
  readonly activa: boolean | null
}

const miningSites = tool(
  'mining_sites',
  'Faenas mineras donde operamos: cliente, provincia, tipo de yacimiento, mineral principal, altitud, proyectos y órdenes de trabajo abiertas, y personal asignado en el mes. Usar para "en qué faenas trabajamos", "dónde operamos", "en qué provincias estamos", "qué minas atendemos", "presencia geográfica", "faenas activas".',
  { solo_activas: z.boolean().optional() },
  async (args): Promise<ToolResult> => {
    const onlyActive = args.solo_activas ?? true
    const filter = onlyActive ? '&activa=is.true' : ''
    const rows = await selectView<SiteRow>(
      'gd_faenas',
      `select=faena,tipo,provincia,altitud_msnm,cliente,mineral_principal,proyectos,ot_abiertas,personal_mes,activa&order=ot_abiertas.desc${filter}&limit=40`,
    )
    if (rows.length === 0) return noData('las faenas')

    const provincias = [...new Set(rows.map((r) => r.provincia).filter(Boolean))]
    const lines = rows.map(
      (r) =>
        `- ${r.faena ?? 'sin nombre'} (${r.cliente ?? 'sin cliente'}) — ${r.provincia ?? 'sin provincia'}, ${r.mineral_principal ?? 'mineral no informado'}, ${formatInteger(r.altitud_msnm)} msnm: ${formatInteger(r.proyectos)} proyectos, ${formatInteger(r.ot_abiertas)} OT abiertas, ${formatInteger(r.personal_mes)} personas en el mes`,
    )
    const header = `Operamos en ${formatInteger(rows.length)} faenas${onlyActive ? ' activas' : ''}, en ${formatInteger(provincias.length)} provincias: ${provincias.join(', ')}.`
    return text(`${header}\n\n${lines.join('\n')}`)
  },
)

// --- Client contacts ---------------------------------------------------------

interface ContactRow {
  readonly contacto: string | null
  readonly cargo: string | null
  readonly area: string | null
  readonly email: string | null
  readonly telefono: string | null
  readonly es_principal: boolean | null
  readonly cliente: string | null
  readonly faena: string | null
}

const clientContacts = tool(
  'client_contacts',
  'Contactos de los clientes con cargo, área, correo, teléfono y en qué faena están, marcando quién es el contacto principal. Usar para "quién es el contacto de tal cliente", "con quién hablamos en", "referentes", "a quién llamo en", "datos de contacto".',
  {
    cliente: z.string().trim().min(2).max(80).optional(),
    solo_principales: z.boolean().optional(),
  },
  async (args): Promise<ToolResult> => {
    // The client name is a filter value, not raw SQL: it is length-bounded and
    // percent-encoded into a PostgREST `ilike`, which is a value comparison.
    const byClient =
      args.cliente === undefined
        ? ''
        : `&cliente=ilike.*${encodeURIComponent(args.cliente)}*`
    const onlyMain = args.solo_principales === true ? '&es_principal=is.true' : ''
    const rows = await selectView<ContactRow>(
      'gd_contactos',
      `select=contacto,cargo,area,email,telefono,es_principal,cliente,faena&activo=is.true${byClient}${onlyMain}&order=es_principal.desc&limit=30`,
    )
    if (rows.length === 0) {
      return noData(args.cliente === undefined ? 'los contactos' : `contactos de ${args.cliente}`)
    }
    const lines = rows.map((r) => {
      const principal = r.es_principal === true ? ' [principal]' : ''
      const faena = r.faena === null ? '' : ` — ${r.faena}`
      return `- ${r.contacto ?? 'sin nombre'}${principal}: ${r.cargo ?? 'sin cargo'}, ${r.area ?? 'sin área'} (${r.cliente ?? 'sin cliente'})${faena}. ${r.email ?? 'sin email'} · ${r.telefono ?? 'sin teléfono'}`
    })
    return text(`Contactos:\n${lines.join('\n')}`)
  },
)

// --- Upcoming agenda ---------------------------------------------------------

interface AgendaRow {
  readonly origen: string | null
  readonly titulo: string | null
  readonly fecha: string | null
  readonly dias_restantes: number | null
  readonly es_hoy: boolean | null
  readonly prioridad: string | null
  readonly cliente: string | null
  readonly responsable: string | null
  readonly monto_ars: string | number | null
}

const upcomingAgenda = tool(
  'upcoming_agenda',
  'AGENDA DE TRABAJO únicamente: trabajos programados y compromisos con fecha, días restantes, prioridad, cliente y responsable. Usar para "qué tenemos esta semana", "agenda", "qué viene", "qué hay programado", "compromisos". NO usar para vencimientos de documentación (usar document_expiries) ni de calibraciones (usar equipment_status).',
  { dias: z.number().int().min(1).max(90).optional() },
  async (args): Promise<ToolResult> => {
    const horizon = args.dias ?? 7
    const rows = await selectView<AgendaRow>(
      'gd_agenda_proxima',
      `select=origen,titulo,fecha,dias_restantes,es_hoy,prioridad,cliente,responsable,monto_ars&dias_restantes=lte.${horizon}&order=fecha.asc&limit=30`,
    )
    if (rows.length === 0) {
      return text(`No hay nada agendado en los próximos ${formatInteger(horizon)} días.`)
    }
    const hoy = rows.filter((r) => r.es_hoy === true).length
    const lines = rows.map((r) => {
      const cuando =
        r.es_hoy === true ? 'HOY' : `en ${formatInteger(r.dias_restantes)} días`
      const monto =
        r.monto_ars === null || Number(r.monto_ars) === 0
          ? ''
          : ` · ${formatArsCompact(r.monto_ars)}`
      return `- ${cuando} (${r.fecha ?? 'sin fecha'}) — ${r.titulo ?? 'sin título'} [${r.origen ?? 'sin origen'}, prioridad ${r.prioridad ?? 'sin definir'}]${r.cliente === null ? '' : ` · ${r.cliente}`}${monto}`
    })
    const header = `${formatInteger(rows.length)} items en los próximos ${formatInteger(horizon)} días${hoy > 0 ? `, ${formatInteger(hoy)} para hoy` : ''}.`
    return text(`${header}\n\n${lines.join('\n')}`)
  },
)

// --- Fleet by type -----------------------------------------------------------

interface VehicleRow {
  readonly tipo: string | null
  readonly marca: string | null
  readonly modelo: string | null
  readonly estado: string | null
  readonly valor_ars: string | number | null
}

const fleetByType = tool(
  'fleet_by_type',
  'Composición de la flota agrupada por tipo de vehículo, con marcas representativas, estado y valor del parque. Usar para "qué vehículos tenemos", "cuántas camionetas", "flota por tipo", "composición de la flota", "qué camiones tenemos".',
  {},
  async (): Promise<ToolResult> => {
    const rows = await selectView<VehicleRow>(
      'gd_vehiculos',
      'select=tipo,marca,modelo,estado,valor_ars&order=tipo.asc&limit=200',
    )
    if (rows.length === 0) return noData('la flota')

    const groups = new Map<string, { n: number; operativos: number; valor: number; marcas: Set<string> }>()
    for (const r of rows) {
      const key = r.tipo ?? 'sin tipo'
      const g = groups.get(key) ?? { n: 0, operativos: 0, valor: 0, marcas: new Set<string>() }
      g.n += 1
      if (r.estado === 'operativo') g.operativos += 1
      g.valor += Number(r.valor_ars ?? 0)
      if (r.marca !== null) g.marcas.add(r.marca)
      groups.set(key, g)
    }

    const lines = [...groups.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .map(
        ([tipo, g]) =>
          `- ${tipo}: ${formatInteger(g.n)} unidades (${formatInteger(g.operativos)} operativas), valor ${formatArsCompact(g.valor)} — ${[...g.marcas].slice(0, 4).join(', ')}`,
      )
    // State the active count alongside the total. `fleet_status` reports on the
    // active fleet only, so a bare total reads as a contradiction next to it.
    const debajas = rows.filter((r) => r.estado === 'baja').length
    const activos = rows.length - debajas
    const header =
      debajas === 0
        ? `Flota por tipo (${formatInteger(rows.length)} vehículos):`
        : `Flota por tipo: ${formatInteger(rows.length)} vehículos en total, de los cuales ${formatInteger(activos)} están activos y ${formatInteger(debajas)} dados de baja.`
    return text(`${header}\n${lines.join('\n')}`)
  },
)

export const ACCOUNT_TOOLS = [miningSites, clientContacts, upcomingAgenda, fleetByType]
