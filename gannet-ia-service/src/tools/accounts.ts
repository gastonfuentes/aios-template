/**
 * Account-side tools: mining sites, the client portfolio by commercial state,
 * client contacts, the upcoming agenda and the fleet broken down by vehicle type.
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
import { MAX_PAGE_ROWS, countView, selectPage } from '../supabase.js'
import { formatArsCompact, formatDate, formatInteger } from '../format.js'
import { CLIENT_STATE, VEHICLE_TYPE, label } from '../labels.js'
import { listedNote, noData, partialWarning, text, type ToolResult } from './helpers.js'

// --- Mining sites ------------------------------------------------------------

/**
 * Rows the site query reads: comfortably above the whole view and far below
 * `MAX_PAGE_ROWS`, so the page is complete and the province rollup is exact.
 */
const SITE_QUERY_CAP = 200

/** Sites spelled out one by one before the answer leans on the rollup instead. */
const SITE_LIST_CAP = 25

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

/** `Catamarca 12, San Juan 9, …`, busiest province first. */
function provinceRollup(rows: readonly SiteRow[]): string {
  const byProvince = new Map<string, number>()
  for (const row of rows) {
    const key = row.provincia ?? 'sin provincia'
    byProvince.set(key, (byProvince.get(key) ?? 0) + 1)
  }
  return [...byProvince.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([provincia, n]) => `${provincia} ${formatInteger(n)}`)
    .join(', ')
}

const miningSites = tool(
  'mining_sites',
  'Faenas mineras donde operamos: cliente, provincia, tipo de yacimiento, mineral principal, altitud, proyectos y órdenes de trabajo abiertas, y personal asignado en el mes. Devuelve el total real de faenas y el desglose completo por provincia. Usar para "en qué faenas trabajamos", "dónde operamos", "en qué provincias estamos", "qué minas atendemos", "presencia geográfica", "faenas activas". Para preguntas sobre una provincia puntual ("qué faenas tenemos en Catamarca", "clientes en San Juan") pasar el parámetro provincia en vez de filtrar a ojo sobre la lista. IMPORTANTE: acá "activa" es una propiedad de la FAENA (si el yacimiento está operando), no del cliente. Esta herramienta no informa el estado comercial del cliente: si preguntan cuántos clientes están activos, morosos, inactivos o son prospectos, usar clients_portfolio, nunca deducirlo de las faenas activas.',
  {
    solo_activas: z.boolean().optional(),
    provincia: z.string().trim().min(2).max(60).optional(),
  },
  async (args): Promise<ToolResult> => {
    const onlyActive = args.solo_activas ?? true
    const filter = onlyActive ? '&activa=is.true' : ''
    // The province is a filter value, not raw SQL: it is length-bounded and
    // percent-encoded into a PostgREST `ilike`, which is a value comparison.
    // Filtering server-side is the point — it stops "faenas en Catamarca" from
    // depending on the model eyeballing a list that may not hold every faena.
    const byProvincia =
      args.provincia === undefined
        ? ''
        : `&provincia=ilike.*${encodeURIComponent(args.provincia)}*`
    const page = await selectPage<SiteRow>(
      'gd_faenas',
      `select=faena,tipo,provincia,altitud_msnm,cliente,mineral_principal,proyectos,ot_abiertas,personal_mes,activa&order=ot_abiertas.desc${filter}${byProvincia}&limit=${SITE_QUERY_CAP}`,
    )
    const rows = page.rows
    if (rows.length === 0) {
      return noData(args.provincia === undefined ? 'las faenas' : `faenas en ${args.provincia}`)
    }

    // The headline count is the server-side total, never `rows.length`: the old
    // `limit=40` published the limit itself as the number of faenas, which cost
    // 14 faenas and made two provinces disappear from the answer.
    const total = page.total ?? rows.length
    const activas = onlyActive ? ' activas' : ''
    const clientes = [...new Set(rows.map((r) => r.cliente).filter((c): c is string => c !== null))]
    const provincias = [...new Set(rows.map((r) => r.provincia).filter((p): p is string => p !== null))]

    // Name the province as the data spells it, not as it was typed: the filter
    // is a case-insensitive `ilike`, so "catamarca" matches and would otherwise
    // be read back to the room in the presenter's own lowercase.
    const label = provincias.length === 1 ? provincias[0] : args.provincia
    const header =
      args.provincia === undefined
        ? `Operamos en ${formatInteger(total)} faenas${activas}, en ${formatInteger(provincias.length)} provincias (${provincias.join(', ')}), para ${formatInteger(clientes.length)} clientes.\nPor provincia: ${provinceRollup(rows)}.`
        : `En ${label} operamos en ${formatInteger(total)} faenas${activas}, para ${formatInteger(clientes.length)} clientes: ${clientes.join(', ')}.`

    const shown = rows.slice(0, SITE_LIST_CAP)
    const lines = shown.map(
      (r) =>
        `- ${r.faena ?? 'sin nombre'} (${r.cliente ?? 'sin cliente'}) — ${r.provincia ?? 'sin provincia'}, ${r.mineral_principal ?? 'mineral no informado'}, ${formatInteger(r.altitud_msnm)} msnm: ${formatInteger(r.proyectos)} proyectos, ${formatInteger(r.ot_abiertas)} OT abiertas, ${formatInteger(r.personal_mes)} personas en el mes`,
    )
    const note = listedNote(shown.length, total, `faenas${activas}, las de mayor carga de OT`)
    return text(`${header}\n\n${lines.join('\n')}${note}${partialWarning(page, 'faenas')}`)
  },
)

// --- Client portfolio --------------------------------------------------------

/**
 * The commercial states a client can hold, spelled exactly as the `clientes`
 * CHECK constraint spells them, ordered as a commercial reading of the book
 * rather than as the constraint lists them: current business first, the problem
 * next, then what is dormant and what is not yet won.
 *
 * They are the enum the model may pass *and* the list the breakdown iterates,
 * so a state that exists in the database can never be silently missing from an
 * answer. `activo` here is a property of the CLIENT (does it currently buy from
 * us) and has nothing to do with `gd_faenas.activa`, which says whether a mine
 * site is operating — conflating the two is what made this tool necessary.
 */
const CLIENT_STATES = ['activo', 'moroso', 'inactivo', 'prospecto'] as const

type ClientState = (typeof CLIENT_STATES)[number]

/** Spanish singular/plural per state, so the header reads "1 moroso, 2 prospectos". */
const STATE_LABEL: Record<ClientState, { readonly one: string; readonly many: string }> = {
  activo: { one: 'activo', many: 'activos' },
  moroso: { one: 'moroso', many: 'morosos' },
  inactivo: { one: 'inactivo', many: 'inactivos' },
  prospecto: { one: 'prospecto', many: 'prospectos' },
}

/** `1 faena` / `2 faenas` — a projector shows "1 faenas" to the whole room. */
function pluralize(value: number | null, one: string, many: string): string {
  return `${formatInteger(value)} ${value === 1 ? one : many}`
}

/**
 * Rows the portfolio query reads: comfortably above the whole view and far
 * below `MAX_PAGE_ROWS`, so the page is complete and the province label taken
 * from the rows is the one the data actually spells.
 */
const CLIENT_QUERY_CAP = Math.min(200, MAX_PAGE_ROWS)

/** Clients spelled out one by one before the answer leans on the breakdown instead. */
const CLIENT_LIST_CAP = 25

interface ClientRow {
  readonly cliente: string | null
  readonly estado: string | null
  readonly provincia: string | null
  readonly localidad: string | null
  readonly mineral_principal: string | null
  readonly ejecutivo_cuenta: string | null
  readonly faenas: number | null
  readonly ot_abiertas: number | null
  readonly facturado_ars: string | number | null
  readonly saldo_pendiente_ars: string | number | null
}

/** `2 activos, 1 moroso, 2 prospectos` — states with no clients are left out. */
function stateBreakdown(counts: readonly (number | null)[]): string {
  const parts: string[] = []
  CLIENT_STATES.forEach((estado, i) => {
    const n = counts[i]
    // A null count is a failed round-trip, not a zero. Saying "sin dato" keeps
    // the state visible instead of quietly reporting it as empty.
    if (n === undefined || n === null) {
      parts.push(`${STATE_LABEL[estado].many}: sin dato`)
      return
    }
    if (n === 0) return
    parts.push(`${formatInteger(n)} ${n === 1 ? STATE_LABEL[estado].one : STATE_LABEL[estado].many}`)
  })
  return parts.join(', ')
}

const clientsPortfolio = tool(
  'clients_portfolio',
  'Cartera de clientes por ESTADO COMERCIAL, con provincia, localidad, mineral, ejecutivo de cuenta, faenas, OT abiertas, facturado y saldo pendiente. Los cuatro estados posibles son activo, inactivo, moroso y prospecto. Sin filtro de estado devuelve el desglose completo ("5 clientes en Catamarca: 2 activos, 1 moroso, 2 prospectos"); con estado devuelve solo esos. Usar SIEMPRE para "cuántos clientes tenemos", "cuántos clientes están activos", "clientes morosos", "clientes inactivos", "prospectos", "cartera de clientes", "clientes por estado", y para cualquier pregunta que cruce provincia con estado ("de los clientes de Catamarca cuántos están activos"). Pasar provincia como parámetro en vez de filtrar a ojo. El estado del cliente es un dato propio del cliente: no se deduce de si sus faenas están activas.',
  {
    provincia: z.string().trim().min(2).max(60).optional(),
    estado: z.enum(CLIENT_STATES).optional(),
  },
  async (args): Promise<ToolResult> => {
    // Both are filter values, not raw SQL: the province is length-bounded and
    // percent-encoded into a PostgREST `ilike`, and the state is one of four
    // literals validated by the enum before it can reach the query string.
    const byProvincia =
      args.provincia === undefined
        ? ''
        : `&provincia=ilike.*${encodeURIComponent(args.provincia)}*`
    const byEstado = args.estado === undefined ? '' : `&estado=eq.${args.estado}`

    const page = await selectPage<ClientRow>(
      'gd_clientes',
      `select=cliente,estado,provincia,localidad,mineral_principal,ejecutivo_cuenta,faenas,ot_abiertas,facturado_ars,saldo_pendiente_ars&order=facturado_ars.desc${byProvincia}${byEstado}&limit=${CLIENT_QUERY_CAP}`,
    )
    const rows = page.rows

    const scope = args.provincia === undefined ? '' : ` en ${args.provincia}`
    if (rows.length === 0) {
      const what =
        args.estado === undefined
          ? `clientes${scope}`
          : `clientes en estado ${args.estado}${scope}`
      return noData(what)
    }

    // The headline is the server-side total, never `rows.length`.
    const total = page.total ?? rows.length

    // Name the province as the data spells it: the filter is a case-insensitive
    // `ilike`, so "catamarca" matches and would otherwise be read back to the
    // room in the presenter's own lowercase. Only ever when a province was
    // actually asked for — inferring one from the rows would label a nationwide
    // answer with whichever province happened to fill the page ("1 cliente
    // moroso en Catamarca" for a question about the whole book).
    let where = ''
    if (args.provincia !== undefined) {
      const provincias = [
        ...new Set(rows.map((r) => r.provincia).filter((p): p is string => p !== null)),
      ]
      where = ` en ${provincias.length === 1 ? provincias[0] : args.provincia}`
    }

    let header: string
    if (args.estado !== undefined) {
      const noun = total === 1 ? 'cliente' : 'clientes'
      const state = total === 1 ? STATE_LABEL[args.estado].one : STATE_LABEL[args.estado].many
      header = `${formatInteger(total)} ${noun} ${state}${where}.`
    } else {
      // One exact server-side count per state instead of tallying the page:
      // a rollup over `rows` reports the page, and the page is not the truth.
      // Issued in parallel so four round-trips cost about one.
      const counts = await Promise.all(
        CLIENT_STATES.map((estado) =>
          countView('gd_clientes', `select=cliente_id${byProvincia}&estado=eq.${estado}`),
        ),
      )
      const noun = total === 1 ? 'cliente' : 'clientes'
      header = `${formatInteger(total)} ${noun}${where}: ${stateBreakdown(counts)}.`
    }

    const shown = rows.slice(0, CLIENT_LIST_CAP)
    const lines = shown.map((r) => {
      const donde = [r.provincia, r.localidad].filter((v) => v !== null).join(', ')
      return `- ${r.cliente ?? 'sin nombre'} [${label(CLIENT_STATE, r.estado)}] — ${donde === '' ? 'sin ubicación' : donde} · ${r.mineral_principal ?? 'mineral no informado'} · ${pluralize(r.faenas, 'faena', 'faenas')}, ${pluralize(r.ot_abiertas, 'OT abierta', 'OT abiertas')} · facturado ${formatArsCompact(r.facturado_ars)}, saldo pendiente ${formatArsCompact(r.saldo_pendiente_ars)} · ejecutivo: ${r.ejecutivo_cuenta ?? 'sin asignar'}`
    })
    // No `partialWarning` here on purpose: every figure above is either a
    // server-side count or a value read off its own row, so there is no
    // aggregate over `rows` that a short page could understate. The only thing
    // the page can cut is the list, and that is exactly what `listedNote` says.
    const note = listedNote(shown.length, total, 'clientes, los de mayor facturación')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
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

/** Contacts read aloud at once; the full book is far longer than a useful answer. */
const CONTACT_QUERY_CAP = 30

const clientContacts = tool(
  'client_contacts',
  'Contactos de los clientes con cargo, área, correo, teléfono y en qué faena están, marcando quién es el contacto principal. Devuelve el total real de contactos y cuántos se listan. Usar para "quién es el contacto de tal cliente", "con quién hablamos en", "referentes", "a quién llamo en", "datos de contacto".',
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
    const page = await selectPage<ContactRow>(
      'gd_contactos',
      `select=contacto,cargo,area,email,telefono,es_principal,cliente,faena&activo=is.true${byClient}${onlyMain}&order=es_principal.desc&limit=${CONTACT_QUERY_CAP}`,
    )
    const rows = page.rows
    if (rows.length === 0) {
      return noData(args.cliente === undefined ? 'los contactos' : `contactos de ${args.cliente}`)
    }
    const lines = rows.map((r) => {
      const principal = r.es_principal === true ? ' [principal]' : ''
      const faena = r.faena === null ? '' : ` — ${r.faena}`
      return `- ${r.contacto ?? 'sin nombre'}${principal}: ${r.cargo ?? 'sin cargo'}, ${r.area ?? 'sin área'} (${r.cliente ?? 'sin cliente'})${faena}. ${r.email ?? 'sin email'} · ${r.telefono ?? 'sin teléfono'}`
    })
    // The page is deliberately short, so the count has to come from the server.
    // "Contactos:" followed by 30 lines invited the model to answer "tenemos 30
    // contactos" when the book holds far more.
    const total = page.total ?? rows.length
    const scope = args.solo_principales === true ? 'contactos principales' : 'contactos activos'
    const header =
      page.truncated
        ? `Hay ${formatInteger(total)} ${scope}${args.cliente === undefined ? '' : ` en ${args.cliente}`}; se listan los primeros ${formatInteger(rows.length)}. Acotá por cliente para ver el resto.`
        : `${formatInteger(total)} ${scope}${args.cliente === undefined ? '' : ` en ${args.cliente}`}:`
    return text(`${header}\n${lines.join('\n')}`)
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

/** Agenda items read aloud at once; a week already holds several times this. */
const AGENDA_QUERY_CAP = 30

const upcomingAgenda = tool(
  'upcoming_agenda',
  'AGENDA DE TRABAJO únicamente: trabajos programados y compromisos con fecha, días restantes, prioridad, cliente y responsable. Devuelve el total real de compromisos del período y cuántos de hoy, y lista los más próximos. Usar para "qué tenemos esta semana", "agenda", "qué viene", "qué hay programado", "compromisos". NO usar para vencimientos de documentación (usar document_expiries) ni de calibraciones (usar equipment_status).',
  // The view only carries the next 14 days (`fecha BETWEEN CURRENT_DATE AND
  // CURRENT_DATE + 14`), so a larger horizon can add nothing but a header that
  // promises a window the agenda does not cover. Capped to the view's real reach.
  { dias: z.number().int().min(1).max(14).optional() },
  async (args): Promise<ToolResult> => {
    const horizon = args.dias ?? 7
    const range = `dias_restantes=lte.${horizon}`
    const page = await selectPage<AgendaRow>(
      'gd_agenda_proxima',
      `select=origen,titulo,fecha,dias_restantes,es_hoy,prioridad,cliente,responsable,monto_ars&${range}&order=fecha.asc&limit=${AGENDA_QUERY_CAP}`,
    )
    const rows = page.rows
    if (rows.length === 0) {
      return text(`No hay nada agendado en los próximos ${formatInteger(horizon)} días.`)
    }
    // Today's count is asked for separately rather than filtered out of the
    // page: the page holds the 30 nearest items, and "how many today" must be
    // the whole day's total even when the day alone overflows the page.
    const hoy = await countView('gd_agenda_proxima', `select=titulo&${range}&es_hoy=is.true`)
    const lines = rows.map((r) => {
      const cuando =
        r.es_hoy === true ? 'HOY' : `en ${formatInteger(r.dias_restantes)} días`
      const monto =
        r.monto_ars === null || Number(r.monto_ars) === 0
          ? ''
          : ` · ${formatArsCompact(r.monto_ars)}`
      return `- ${cuando} (${formatDate(r.fecha)}) — ${r.titulo ?? 'sin título'} [${r.origen ?? 'sin origen'}, prioridad ${r.prioridad ?? 'sin definir'}]${r.cliente === null ? '' : ` · ${r.cliente}`}${monto}`
    })
    // `rows.length` used to be published as the item count, so a full week of
    // work was always announced as exactly the page size.
    const total = page.total ?? rows.length
    const hoyNote = hoy === null || hoy === 0 ? '' : `, ${formatInteger(hoy)} para hoy`
    const header = `${formatInteger(total)} items en los próximos ${formatInteger(horizon)} días${hoyNote}.`
    const note = listedNote(rows.length, total, 'items, los más próximos primero')
    return text(`${header}\n\n${lines.join('\n')}${note}`)
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
    const page = await selectPage<VehicleRow>(
      'gd_vehiculos',
      'select=tipo,marca,modelo,estado,valor_ars&order=tipo.asc&limit=200',
    )
    const rows = page.rows
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
          `- ${label(VEHICLE_TYPE, tipo)}: ${formatInteger(g.n)} unidades (${formatInteger(g.operativos)} operativas), valor ${formatArsCompact(g.valor)} — ${[...g.marcas].slice(0, 4).join(', ')}`,
      )
    // State the active count alongside the total. `fleet_status` reports on the
    // active fleet only, so a bare total reads as a contradiction next to it.
    // The total is the server-side count, not the page size, so the figure holds
    // even if the fleet ever outgrows the query cap.
    const total = page.total ?? rows.length
    const debajas = rows.filter((r) => r.estado === 'baja').length
    const activos = rows.length - debajas
    const header =
      debajas === 0
        ? `Flota por tipo (${formatInteger(total)} vehículos):`
        : `Flota por tipo: ${formatInteger(total)} vehículos en total, de los cuales ${formatInteger(activos)} están activos y ${pluralize(debajas, 'está dado de baja', 'están dados de baja')}.`
    return text(`${header}\n${lines.join('\n')}${partialWarning(page, 'vehículos')}`)
  },
)

export const ACCOUNT_TOOLS = [
  miningSites,
  clientsPortfolio,
  clientContacts,
  upcomingAgenda,
  fleetByType,
]
