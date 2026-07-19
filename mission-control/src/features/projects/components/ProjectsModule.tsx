'use client'

/**
 * Projects module — grid over `gd_proyectos_estado`.
 *
 * The view already computes physical progress, economic progress, the gap
 * between them and the delay in days, so the module's job is to make the
 * unhealthy rows obvious: anything past its planned end date is flagged red and
 * sorted to the top by default.
 */

import { useMemo } from 'react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useView } from '@/features/gannet/useView'
import { CONTRACT_TYPE, PROJECT_STATE, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDate,
  formatInteger,
  formatPercent,
} from '@/features/gannet/format'
import type { ProyectoEstado } from '@/features/gannet/types'

/** Inline progress bar. Deliberately not the Radix `Progress` primitive: this
 *  renders once per row and needs no animation or accessibility state beyond the
 *  numeric label already shown next to it. */
function ProgressBar({ value }: { value: number | null }) {
  const pct = Math.max(0, Math.min(100, value ?? 0))
  const color = pct >= 90 ? 'var(--sys-green)' : pct >= 50 ? 'var(--sys-blue)' : 'var(--sys-orange)'
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full"
        style={{ background: 'var(--fill-secondary)' }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="tabular-nums text-caption1" style={{ color: 'var(--label-secondary)' }}>
        {value === null ? EMPTY : `${pct} %`}
      </span>
    </div>
  )
}

const COLUMNS: readonly Column<ProyectoEstado>[] = [
  {
    key: 'proyecto',
    header: 'Proyecto',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.proyecto}
        </div>
        <div className="truncate text-caption2 tabular-nums" style={{ color: 'var(--label-tertiary)' }}>
          {row.proyecto_codigo}
        </div>
      </div>
    ),
    sortValue: (row) => row.proyecto,
    searchValue: (row) => `${row.proyecto} ${row.proyecto_codigo} ${row.faena ?? ''}`,
  },
  {
    key: 'cliente',
    header: 'Cliente',
    hideBelow: 'md',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.cliente ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.servicio ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.cliente,
    searchValue: (row) => `${row.cliente ?? ''} ${row.servicio ?? ''} ${row.responsable ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(PROJECT_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'tipo_contrato',
    header: 'Contrato',
    hideBelow: 'xl',
    render: (row) => describe(CONTRACT_TYPE, row.tipo_contrato).label,
    sortValue: (row) => row.tipo_contrato,
  },
  {
    key: 'avance_pct',
    header: 'Avance físico',
    render: (row) => <ProgressBar value={row.avance_pct} />,
    sortValue: (row) => row.avance_pct,
  },
  {
    key: 'avance_economico_pct',
    header: 'Avance económico',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => formatPercent(row.avance_economico_pct),
    sortValue: (row) => row.avance_economico_pct,
  },
  {
    key: 'fecha_fin_plan',
    header: 'Fin planificado',
    hideBelow: 'md',
    render: (row) => formatDate(row.fecha_fin_plan),
    sortValue: (row) => row.fecha_fin_plan,
  },
  {
    key: 'dias_atraso',
    header: 'Atraso',
    align: 'right',
    render: (row) =>
      (row.dias_atraso ?? 0) > 0 ? (
        <Pill tone="critical">{`${formatInteger(row.dias_atraso)} d`}</Pill>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>En plazo</span>
      ),
    sortValue: (row) => row.dias_atraso,
  },
  {
    key: 'ot_abiertas',
    header: 'OT abiertas',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => `${formatInteger(row.ot_abiertas)} / ${formatInteger(row.ot_total)}`,
    sortValue: (row) => row.ot_abiertas,
  },
  {
    key: 'monto_contrato_ars',
    header: 'Contrato',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.monto_contrato_ars)}</span>,
    sortValue: (row) => row.monto_contrato_ars,
  },
]

export function ProjectsModule() {
  const { rows, loading, error, reload } = useView<ProyectoEstado>('gd_proyectos_estado')

  const summary = useMemo(() => {
    const overdue = rows.filter((row) => row.esta_vencido === true)
    const active = rows.filter((row) => row.estado === 'en_curso')
    const contracted = rows.reduce((total, row) => total + (row.monto_contrato_ars ?? 0), 0)
    const executed = rows.reduce((total, row) => total + (row.monto_ejecutado_ars ?? 0), 0)
    return { overdue: overdue.length, active: active.length, contracted, executed }
  }, [rows])

  return (
    <ModuleShell
      title="Proyectos"
      description="Cartera de proyectos con avance físico, avance económico y atraso respecto del plan."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Proyectos en cartera"
          value={formatInteger(rows.length)}
          hint={`${formatInteger(summary.active)} en curso`}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Proyectos atrasados"
          value={formatInteger(summary.overdue)}
          hint="Superaron la fecha de fin planificada"
          tone={summary.overdue > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Monto contratado"
          value={formatArsCompact(summary.contracted)}
          hint="Suma de contratos vigentes"
          tone="positive"
          loading={loading}
        />
        <StatCard
          label="Monto ejecutado"
          value={formatArsCompact(summary.executed)}
          hint={
            summary.contracted > 0
              ? `${formatPercent((summary.executed / summary.contracted) * 100)} del contratado`
              : undefined
          }
          tone="accent"
          loading={loading}
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={COLUMNS}
        getRowId={(row) => String(row.proyecto_id)}
        loading={loading}
        initialSort={{ key: 'dias_atraso', direction: 'desc' }}
        searchPlaceholder="Buscar por proyecto, código, cliente o faena…"
        emptyMessage="Todavía no hay proyectos cargados."
        rowAccent={(row) => (row.esta_vencido ? 'var(--sys-red)' : null)}
      />
    </ModuleShell>
  )
}
