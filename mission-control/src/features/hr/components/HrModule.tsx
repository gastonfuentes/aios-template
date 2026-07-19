'use client'

/**
 * Human resources module — headcount from `gd_empleados` with the per-area
 * summary from `gd_rrhh_resumen`.
 *
 * The area summary is a small, fixed set (eight rows), so it renders as an
 * always-visible table above the roster rather than behind a tab.
 */

import { useMemo } from 'react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleSection, ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useViews2 } from '@/features/gannet/useView'
import {
  EMPLOYEE_AREA,
  EMPLOYEE_STATE,
  SHIFT_PATTERN,
  describe,
} from '@/features/gannet/labels'
import {
  EMPTY,
  formatArs,
  formatArsCompact,
  formatDate,
  formatDecimal,
  formatInteger,
  formatPercent,
} from '@/features/gannet/format'
import type { Empleado, RrhhResumen } from '@/features/gannet/types'

const EMPLOYEE_COLUMNS: readonly Column<Empleado>[] = [
  {
    key: 'empleado',
    header: 'Empleado',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.empleado}
        </div>
        <div className="truncate text-caption2 tabular-nums" style={{ color: 'var(--label-tertiary)' }}>
          Legajo {row.legajo}
        </div>
      </div>
    ),
    sortValue: (row) => row.empleado,
    searchValue: (row) => `${row.empleado} ${row.legajo} ${row.documento ?? ''}`,
  },
  {
    key: 'puesto',
    header: 'Puesto',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.puesto ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(EMPLOYEE_AREA, row.area).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.puesto,
    searchValue: (row) => `${row.puesto ?? ''} ${row.area ?? ''} ${row.especialidad ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(EMPLOYEE_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'modalidad_turno',
    header: 'Turno',
    hideBelow: 'md',
    render: (row) => describe(SHIFT_PATTERN, row.modalidad_turno).label,
    sortValue: (row) => row.modalidad_turno,
  },
  {
    key: 'supervisor',
    header: 'Supervisor',
    hideBelow: 'xl',
    render: (row) => row.supervisor ?? EMPTY,
    sortValue: (row) => row.supervisor,
    searchValue: (row) => row.supervisor ?? '',
  },
  {
    key: 'fecha_ingreso',
    header: 'Ingreso',
    hideBelow: 'lg',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="tabular-nums">{formatDate(row.fecha_ingreso)}</span>
        <span className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {formatDecimal(row.antiguedad_anios)} años
        </span>
      </div>
    ),
    sortValue: (row) => row.fecha_ingreso,
  },
  {
    key: 'horas_mes',
    header: 'Horas del mes',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => <span className="tabular-nums">{formatDecimal(row.horas_mes)}</span>,
    sortValue: (row) => row.horas_mes,
  },
  {
    key: 'ausencias_mes',
    header: 'Ausencias',
    align: 'right',
    hideBelow: 'xl',
    render: (row) =>
      (row.ausencias_mes ?? 0) > 0 ? (
        <Pill tone="warning">{formatInteger(row.ausencias_mes)}</Pill>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>0</span>
      ),
    sortValue: (row) => row.ausencias_mes,
  },
  {
    key: 'ot_abiertas',
    header: 'OT a cargo',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => formatInteger(row.ot_abiertas),
    sortValue: (row) => row.ot_abiertas,
  },
  {
    key: 'costo_hora_ars',
    header: 'Costo hora',
    align: 'right',
    hideBelow: 'md',
    render: (row) => <span className="tabular-nums">{formatArs(row.costo_hora_ars)}</span>,
    sortValue: (row) => row.costo_hora_ars,
  },
]

const AREA_COLUMNS: readonly Column<RrhhResumen>[] = [
  {
    key: 'area',
    header: 'Área',
    render: (row) => describe(EMPLOYEE_AREA, row.area).label,
    sortValue: (row) => row.area,
    searchValue: (row) => row.area,
  },
  {
    key: 'dotacion_activa',
    header: 'Dotación activa',
    align: 'right',
    render: (row) => `${formatInteger(row.dotacion_activa)} / ${formatInteger(row.dotacion_total)}`,
    sortValue: (row) => row.dotacion_activa,
  },
  {
    key: 'en_licencia',
    header: 'En licencia',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => formatInteger(row.en_licencia),
    sortValue: (row) => row.en_licencia,
  },
  {
    key: 'ausentismo_pct',
    header: 'Ausentismo',
    align: 'right',
    render: (row) => {
      const value = row.ausentismo_pct
      const tone = value === null ? 'neutral' : value >= 8 ? 'critical' : value >= 5 ? 'warning' : 'positive'
      return <Pill tone={tone}>{formatPercent(value)}</Pill>
    },
    sortValue: (row) => row.ausentismo_pct,
  },
  {
    key: 'accidentes_mes',
    header: 'Accidentes del mes',
    align: 'right',
    render: (row) =>
      (row.accidentes_mes ?? 0) > 0 ? (
        <Pill tone="critical">{formatInteger(row.accidentes_mes)}</Pill>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>0</span>
      ),
    sortValue: (row) => row.accidentes_mes,
  },
  {
    key: 'incidentes_seguridad_ytd',
    header: 'Incidentes del año',
    align: 'right',
    hideBelow: 'md',
    render: (row) => formatInteger(row.incidentes_seguridad_ytd),
    sortValue: (row) => row.incidentes_seguridad_ytd,
  },
  {
    key: 'horas_mes',
    header: 'Horas del mes',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => <span className="tabular-nums">{formatDecimal(row.horas_mes)}</span>,
    sortValue: (row) => row.horas_mes,
  },
  {
    key: 'costo_horas_mes_ars',
    header: 'Costo del mes',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">{formatArsCompact(row.costo_horas_mes_ars)}</span>
    ),
    sortValue: (row) => row.costo_horas_mes_ars,
  },
]

export function HrModule() {
  const { primary: employees, secondary: areas, loading, error, reload } = useViews2<
    Empleado,
    RrhhResumen
  >('gd_empleados', 'gd_rrhh_resumen')

  const summary = useMemo(() => {
    const active = employees.filter((row) => row.estado === 'activo').length
    const onLeave = employees.filter((row) => row.estado === 'licencia').length
    const accidents = areas.reduce((sum, row) => sum + (row.accidentes_mes ?? 0), 0)
    const monthCost = areas.reduce((sum, row) => sum + (row.costo_horas_mes_ars ?? 0), 0)
    return { active, onLeave, accidents, monthCost }
  }, [employees, areas])

  return (
    <ModuleShell
      title="Recursos humanos"
      description="Dotación por área, situación de revista, ausentismo y costo de horas del período."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Dotación activa"
          value={`${formatInteger(summary.active)} / ${formatInteger(employees.length)}`}
          hint="Personal en actividad"
          tone="positive"
          loading={loading}
        />
        <StatCard
          label="En licencia"
          value={formatInteger(summary.onLeave)}
          hint="Ausencias justificadas vigentes"
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Accidentes del mes"
          value={formatInteger(summary.accidents)}
          hint="Registrados en todas las áreas"
          tone={summary.accidents > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Costo de horas del mes"
          value={formatArsCompact(summary.monthCost)}
          hint="Mano de obra imputada al período"
          tone="accent"
          loading={loading}
        />
      </StatGrid>

      <ModuleSection title="Resumen por área">
        <DataTable
          rows={areas}
          columns={AREA_COLUMNS}
          getRowId={(row) => row.area}
          loading={loading}
          pageSize={20}
          searchable={false}
          initialSort={{ key: 'dotacion_activa', direction: 'desc' }}
          emptyMessage="Todavía no hay áreas con dotación registrada."
          rowAccent={(row) => ((row.accidentes_mes ?? 0) > 0 ? 'var(--sys-red)' : null)}
        />
      </ModuleSection>

      <ModuleSection title="Nómina">
        <DataTable
          rows={employees}
          columns={EMPLOYEE_COLUMNS}
          getRowId={(row) => String(row.empleado_id)}
          loading={loading}
          initialSort={{ key: 'empleado', direction: 'asc' }}
          searchPlaceholder="Buscar por nombre, legajo, puesto o área…"
          emptyMessage="Todavía no hay empleados cargados."
          rowAccent={(row) => (row.estado === 'suspendido' ? 'var(--sys-orange)' : null)}
        />
      </ModuleSection>
    </ModuleShell>
  )
}
