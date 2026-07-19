'use client'

/**
 * Fleet module — grid over `gd_flota_estado`.
 *
 * The view carries both expiry dates and the precomputed flags
 * (`vtv_vencida`, `seguro_vencido`, and their 30-day warning counterparts), so
 * the module renders each vehicle's roadworthiness inline. Default sort is by
 * days-to-inspection ascending, which puts the expired vehicles at the top
 * without the presenter touching anything.
 */

import { useMemo } from 'react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useView } from '@/features/gannet/useView'
import { VEHICLE_STATE, VEHICLE_TYPE, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDate,
  formatDaysRemaining,
  formatInteger,
} from '@/features/gannet/format'
import { toneForDaysRemaining } from '@/features/gannet/tone'
import type { FlotaEstado } from '@/features/gannet/types'

/** Expiry cell shared by the inspection and insurance columns. */
function ExpiryCell({ date, days }: { date: string | null; days: number | null }) {
  if (date === null) return <span style={{ color: 'var(--label-tertiary)' }}>{EMPTY}</span>
  return (
    <div className="flex flex-col gap-0.5">
      <span className="tabular-nums">{formatDate(date)}</span>
      <Pill tone={toneForDaysRemaining(days)}>{formatDaysRemaining(days)}</Pill>
    </div>
  )
}

const COLUMNS: readonly Column<FlotaEstado>[] = [
  {
    key: 'dominio',
    header: 'Dominio',
    render: (row) => (
      <div className="min-w-0">
        <div className="tabular-nums" style={{ color: 'var(--label-primary)' }}>
          {row.dominio}
        </div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(VEHICLE_TYPE, row.tipo).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.dominio,
    searchValue: (row) => `${row.dominio} ${row.tipo ?? ''}`,
  },
  {
    key: 'marca',
    header: 'Vehículo',
    hideBelow: 'md',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{[row.marca, row.modelo].filter(Boolean).join(' ') || EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.anio === null ? EMPTY : `${row.anio} · ${formatInteger(row.antiguedad_anios)} años`}
        </div>
      </div>
    ),
    sortValue: (row) => row.marca,
    searchValue: (row) => `${row.marca ?? ''} ${row.modelo ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(VEHICLE_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'vtv_vence_el',
    header: 'VTV',
    render: (row) => <ExpiryCell date={row.vtv_vence_el} days={row.dias_para_vtv} />,
    sortValue: (row) => row.dias_para_vtv,
  },
  {
    key: 'seguro_vence_el',
    header: 'Seguro',
    render: (row) => <ExpiryCell date={row.seguro_vence_el} days={row.dias_para_seguro} />,
    sortValue: (row) => row.dias_para_seguro,
  },
  {
    key: 'responsable',
    header: 'Responsable',
    hideBelow: 'lg',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.responsable ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.deposito_base ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.responsable,
    searchValue: (row) => `${row.responsable ?? ''} ${row.deposito_base ?? ''}`,
  },
  {
    key: 'km_actual',
    header: 'Kilometraje',
    align: 'right',
    hideBelow: 'xl',
    render: (row) => (
      <span className="tabular-nums">
        {row.km_actual === null ? EMPTY : `${formatInteger(row.km_actual)} km`}
      </span>
    ),
    sortValue: (row) => row.km_actual,
  },
  {
    key: 'mantenimientos_pendientes',
    header: 'Mant. pendiente',
    align: 'right',
    hideBelow: 'lg',
    render: (row) =>
      (row.mantenimientos_pendientes ?? 0) > 0 ? (
        <Pill tone="warning">{formatInteger(row.mantenimientos_pendientes)}</Pill>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>0</span>
      ),
    sortValue: (row) => row.mantenimientos_pendientes,
  },
  {
    key: 'ot_en_curso',
    header: 'OT en curso',
    align: 'right',
    hideBelow: 'xl',
    render: (row) => formatInteger(row.ot_en_curso),
    sortValue: (row) => row.ot_en_curso,
  },
  {
    key: 'valor_ars',
    header: 'Valor',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.valor_ars)}</span>,
    sortValue: (row) => row.valor_ars,
  },
]

export function FleetModule() {
  const { rows, loading, error, reload } = useView<FlotaEstado>('gd_flota_estado')

  const summary = useMemo(() => {
    const operational = rows.filter((row) => row.esta_operativo === true).length
    const expiredInspection = rows.filter((row) => row.vtv_vencida === true).length
    const expiredInsurance = rows.filter((row) => row.seguro_vencido === true).length
    const expiringSoon = rows.filter(
      (row) => row.vtv_por_vencer_30d === true || row.seguro_por_vencer_30d === true,
    ).length
    return { operational, expiredInspection, expiredInsurance, expiringSoon }
  }, [rows])

  return (
    <ModuleShell
      title="Flota de vehículos"
      description="Estado operativo de la flota y vencimientos de verificación técnica y seguro."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Flota operativa"
          value={`${formatInteger(summary.operational)} / ${formatInteger(rows.length)}`}
          hint="Vehículos en condiciones de circular"
          tone="positive"
          loading={loading}
        />
        <StatCard
          label="VTV vencida"
          value={formatInteger(summary.expiredInspection)}
          hint="Verificación técnica fuera de término"
          tone={summary.expiredInspection > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Seguro vencido"
          value={formatInteger(summary.expiredInsurance)}
          hint="Póliza fuera de vigencia"
          tone={summary.expiredInsurance > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Vencen en 30 días"
          value={formatInteger(summary.expiringSoon)}
          hint="VTV o seguro próximos a vencer"
          tone={summary.expiringSoon > 0 ? 'warning' : 'positive'}
          loading={loading}
        />
      </StatGrid>

      <DataTable
        rows={rows}
        columns={COLUMNS}
        getRowId={(row) => String(row.vehiculo_id)}
        loading={loading}
        initialSort={{ key: 'vtv_vence_el', direction: 'asc' }}
        searchPlaceholder="Buscar por dominio, marca o responsable…"
        emptyMessage="Todavía no hay vehículos cargados."
        rowAccent={(row) =>
          row.vtv_vencida || row.seguro_vencido
            ? 'var(--sys-red)'
            : row.vtv_por_vencer_30d || row.seguro_por_vencer_30d
              ? 'var(--sys-orange)'
              : null
        }
      />
    </ModuleShell>
  )
}
