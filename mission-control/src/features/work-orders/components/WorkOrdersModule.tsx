'use client'

/**
 * Work orders module — grid over `gd_ot_operativas` (1,350 rows) plus the
 * operational load summary from `gd_ot_carga_operativa`.
 *
 * This is the largest dataset in the demo and the module presented live, so it
 * gets the extra affordances the other grids do without: state and priority
 * filters alongside the free-text search, and a summary strip that doubles as
 * the narration hook ("we have N open, M of them overdue").
 *
 * Row rendering is bounded by the table's pagination — sorting and filtering run
 * over all 1,350 rows, only a page is mounted. Depth (drill-down into a single
 * order) is day 3.
 */

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useView } from '@/features/gannet/useView'
import {
  WORK_ORDER_PRIORITY,
  WORK_ORDER_STATE,
  WORK_ORDER_TYPE,
  describe,
} from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDate,
  formatDecimal,
  formatInteger,
} from '@/features/gannet/format'
import type { OtCargaOperativa, OtOperativa } from '@/features/gannet/types'

/** Ordered so the filter reads as a lifecycle, not an alphabetical list. */
const STATE_OPTIONS = [
  'borrador',
  'programada',
  'en_ejecucion',
  'pausada',
  'completada',
  'cancelada',
] as const

const PRIORITY_OPTIONS = ['critica', 'alta', 'media', 'baja'] as const

const COLUMNS: readonly Column<OtOperativa>[] = [
  {
    key: 'ot_numero',
    header: 'OT',
    render: (row) => <span className="tabular-nums">{row.ot_numero}</span>,
    sortValue: (row) => row.ot_numero,
    searchValue: (row) => row.ot_numero,
  },
  {
    key: 'titulo',
    header: 'Trabajo',
    width: '22rem',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.titulo}
        </div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.servicio ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.titulo,
    searchValue: (row) => `${row.titulo} ${row.servicio ?? ''} ${row.proyecto_codigo ?? ''}`,
  },
  {
    key: 'cliente',
    header: 'Cliente',
    hideBelow: 'md',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.cliente ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.faena ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.cliente,
    searchValue: (row) => `${row.cliente ?? ''} ${row.faena ?? ''} ${row.faena_provincia ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(WORK_ORDER_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'prioridad',
    header: 'Prioridad',
    render: (row) => {
      const priority = describe(WORK_ORDER_PRIORITY, row.prioridad)
      return <Pill tone={priority.tone}>{priority.label}</Pill>
    },
    sortValue: (row) => row.prioridad,
    searchValue: (row) => row.prioridad,
  },
  {
    key: 'tipo',
    header: 'Tipo',
    hideBelow: 'xl',
    render: (row) => describe(WORK_ORDER_TYPE, row.tipo).label,
    sortValue: (row) => row.tipo,
  },
  {
    key: 'responsable',
    header: 'Responsable',
    hideBelow: 'lg',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.responsable ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.responsable_area ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.responsable,
    searchValue: (row) => row.responsable ?? '',
  },
  {
    key: 'fecha_programada',
    header: 'Programada',
    hideBelow: 'sm',
    render: (row) =>
      row.esta_atrasada ? (
        <Pill tone="critical" title="La fecha programada ya pasó y la orden sigue abierta">
          {formatDate(row.fecha_programada)}
        </Pill>
      ) : (
        formatDate(row.fecha_programada)
      ),
    sortValue: (row) => row.fecha_programada,
  },
  {
    key: 'horas',
    header: 'Horas real / est.',
    align: 'right',
    hideBelow: 'xl',
    render: (row) => (
      <span className="tabular-nums">
        {formatDecimal(row.horas_reales)} / {formatDecimal(row.horas_estimadas)}
      </span>
    ),
    sortValue: (row) => row.desvio_horas,
  },
  {
    key: 'incidentes_seguridad',
    header: 'Incid.',
    align: 'right',
    hideBelow: 'lg',
    render: (row) =>
      (row.incidentes_seguridad ?? 0) > 0 ? (
        <Pill tone="critical">{formatInteger(row.incidentes_seguridad)}</Pill>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>0</span>
      ),
    sortValue: (row) => row.incidentes_seguridad,
  },
  {
    key: 'monto_facturable_ars',
    header: 'Facturable',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">{formatArsCompact(row.monto_facturable_ars)}</span>
    ),
    sortValue: (row) => row.monto_facturable_ars,
  },
]

export function WorkOrdersModule() {
  // `?cliente=<id>` is the drill-down target of the executive client ranking.
  // It is pushed to the server as a `cliente_id` filter — the API route honours
  // it because `gd_ot_operativas` declares that column in its `filters` array.
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientParam = searchParams.get('cliente') ?? ''

  // The drill-down is driven by local state seeded from the query string rather
  // than by the query string directly. When this page is opened as a hard load
  // on `?cliente=<id>` — a reload or a deep link — a client-side `router.push`
  // back to `/ordenes-trabajo` does not change the URL, which used to leave the
  // presenter locked inside the filtered grid with no way out on stage. Holding
  // the filter in state makes clearing it independent of the router; the push
  // below is kept as best-effort URL hygiene.
  const [clientId, setClientId] = useState(clientParam)
  const [syncedParam, setSyncedParam] = useState(clientParam)
  if (syncedParam !== clientParam) {
    // Adjusting state during render — a new `?cliente=` (a fresh drill-down
    // from the executive ranking) reopens the filter without an effect pass.
    setSyncedParam(clientParam)
    setClientId(clientParam)
  }

  const clearClient = () => {
    setClientId('')
    router.push('/ordenes-trabajo')
  }

  const ordersView = useView<OtOperativa>('gd_ot_operativas', {
    params: { cliente_id: clientId },
  })
  const loadView = useView<OtCargaOperativa>('gd_ot_carga_operativa')

  const orders = ordersView.rows
  const load = loadView.rows
  const loading = ordersView.loading || loadView.loading
  const error = ordersView.error ?? loadView.error
  const reload = () => {
    ordersView.reload()
    loadView.reload()
  }

  const clientName = clientId === '' ? null : (orders[0]?.cliente ?? null)

  const [stateFilter, setStateFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')

  const visible = useMemo(
    () =>
      orders.filter(
        (row) =>
          (stateFilter === '' || row.estado === stateFilter) &&
          (priorityFilter === '' || row.prioridad === priorityFilter),
      ),
    [orders, stateFilter, priorityFilter],
  )

  // Summary normally comes from the aggregate view, which is authoritative and
  // stays correct regardless of the row cap. Under a client drill-down the
  // aggregate is company-wide and would contradict the grid below it, so the
  // figures are derived from the (already server-filtered) rows instead.
  const summary = useMemo(() => {
    if (clientId !== '') {
      let open = 0
      let late = 0
      let executing = 0
      let billable = 0
      for (const order of orders) {
        if (order.esta_abierta) open += 1
        if (order.estado === 'en_ejecucion') executing += 1
        if (order.esta_atrasada) late += 1
        billable += order.monto_facturable_ars ?? 0
      }
      return { open, late, executing, billable }
    }

    let open = 0
    let late = 0
    let executing = 0
    let billable = 0
    for (const bucket of load) {
      if (bucket.esta_abierta) open += bucket.cantidad ?? 0
      if (bucket.estado === 'en_ejecucion') executing += bucket.cantidad ?? 0
      late += bucket.atrasadas ?? 0
      billable += bucket.monto_facturable_ars ?? 0
    }
    return { open, late, executing, billable }
  }, [load, orders, clientId])

  return (
    <ModuleShell
      title="Órdenes de trabajo"
      description="Ejecución operativa en faena: estado, prioridad, responsable y desvío de horas de cada orden."
      loading={loading}
      error={error}
      onReload={reload}
      actions={
        clientId === '' ? undefined : (
          <button
            type="button"
            onClick={clearClient}
            className="mc-interactive inline-flex h-11 items-center gap-2 rounded-control px-4 text-caption1"
            style={{ background: 'var(--fill-secondary)', color: 'var(--label-primary)' }}
          >
            <X size={14} strokeWidth={2} aria-hidden />
            {`Cliente: ${clientName ?? clientId}`}
          </button>
        )
      }
    >
      <StatGrid>
        <StatCard
          label="Órdenes abiertas"
          value={formatInteger(summary.open)}
          hint={`${formatInteger(summary.executing)} en ejecución`}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Órdenes atrasadas"
          value={formatInteger(summary.late)}
          hint="Fecha programada vencida"
          tone={summary.late > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Órdenes registradas"
          value={formatInteger(orders.length)}
          hint="Histórico completo cargado"
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Monto facturable"
          value={formatArsCompact(summary.billable)}
          hint="Suma de todas las órdenes"
          tone="positive"
          loading={loading}
        />
      </StatGrid>

      <DataTable
        rows={visible}
        columns={COLUMNS}
        getRowId={(row) => String(row.ot_id)}
        loading={loading}
        pageSize={30}
        initialSort={{ key: 'fecha_programada', direction: 'desc' }}
        searchPlaceholder="Buscar por número, trabajo, cliente o responsable…"
        emptyMessage="Todavía no hay órdenes de trabajo cargadas."
        noResultsMessage="Ninguna orden coincide con los filtros aplicados."
        rowAccent={(row) =>
          row.esta_atrasada
            ? 'var(--sys-red)'
            : row.prioridad === 'critica'
              ? 'var(--sys-orange)'
              : null
        }
        toolbar={
          <div className="flex shrink-0 items-center gap-2">
            <FilterSelect
              label="Estado"
              value={stateFilter}
              onChange={setStateFilter}
              options={STATE_OPTIONS.map((value) => ({
                value,
                label: describe(WORK_ORDER_STATE, value).label,
              }))}
            />
            <FilterSelect
              label="Prioridad"
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={PRIORITY_OPTIONS.map((value) => ({
                value,
                label: describe(WORK_ORDER_PRIORITY, value).label,
              }))}
            />
          </div>
        }
      />
    </ModuleShell>
  )
}

/**
 * Native select rather than the Radix `Select` primitive: it needs no custom
 * rendering, and a native control is the most reliable thing to click on an
 * unfamiliar machine during a live demo.
 */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: readonly { value: string; label: string }[]
}) {
  return (
    <select
      aria-label={`Filtrar por ${label.toLocaleLowerCase('es-AR')}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mc-interactive-soft h-11 rounded-control px-3 text-caption1 outline-none"
      style={{
        background: 'var(--fill-secondary)',
        color: value ? 'var(--label-primary)' : 'var(--label-secondary)',
      }}
    >
      <option value="">{label}: todos</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
