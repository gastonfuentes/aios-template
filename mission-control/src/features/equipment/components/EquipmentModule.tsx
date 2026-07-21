'use client'

/**
 * Equipment module — parc inventory from `gd_equipos` with the availability
 * breakdown from `gd_equipos_disponibilidad`.
 *
 * The seeded signal here is calibration: instruments past their calibration date
 * cannot legally be used in faena, so overdue calibrations are flagged red and
 * surfaced in the summary strip.
 */

import { useMemo, useState } from 'react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs'
import { useViews2 } from '@/features/gannet/useView'
import { EQUIPMENT_CATEGORY, EQUIPMENT_STATE, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDate,
  formatDaysRemaining,
  formatInteger,
} from '@/features/gannet/format'
import { toneForDaysRemaining } from '@/features/gannet/tone'
import type { Equipo, EquipoDisponibilidad } from '@/features/gannet/types'

const EQUIPMENT_COLUMNS: readonly Column<Equipo>[] = [
  {
    key: 'equipo',
    header: 'Equipo',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.equipo}
        </div>
        <div className="truncate text-caption2 tabular-nums" style={{ color: 'var(--label-tertiary)' }}>
          {row.codigo_interno}
        </div>
      </div>
    ),
    sortValue: (row) => row.equipo,
    searchValue: (row) => `${row.equipo} ${row.codigo_interno} ${row.marca ?? ''} ${row.modelo ?? ''}`,
  },
  {
    key: 'categoria',
    header: 'Categoría',
    hideBelow: 'md',
    render: (row) => describe(EQUIPMENT_CATEGORY, row.categoria).label,
    sortValue: (row) => row.categoria,
    searchValue: (row) => row.categoria ?? '',
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(EQUIPMENT_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'marca',
    header: 'Marca y modelo',
    hideBelow: 'xl',
    render: (row) => [row.marca, row.modelo].filter(Boolean).join(' ') || EMPTY,
    sortValue: (row) => row.marca,
  },
  {
    key: 'deposito',
    header: 'Ubicación',
    hideBelow: 'lg',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.deposito ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.responsable ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.deposito,
    searchValue: (row) => `${row.deposito ?? ''} ${row.responsable ?? ''}`,
  },
  {
    key: 'proxima_calibracion',
    header: 'Próxima calibración',
    render: (row) => {
      if (row.proxima_calibracion === null) {
        return <span style={{ color: 'var(--label-tertiary)' }}>No requiere</span>
      }
      return (
        <div className="flex flex-col gap-0.5">
          <span className="tabular-nums">{formatDate(row.proxima_calibracion)}</span>
          <Pill tone={toneForDaysRemaining(row.dias_para_calibracion)}>
            {formatDaysRemaining(row.dias_para_calibracion)}
          </Pill>
        </div>
      )
    },
    sortValue: (row) => row.dias_para_calibracion,
  },
  {
    key: 'ot_en_curso',
    header: 'OT en curso',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => formatInteger(row.ot_en_curso),
    sortValue: (row) => row.ot_en_curso,
  },
  {
    key: 'tarifa_dia_ars',
    header: 'Tarifa diaria',
    align: 'right',
    hideBelow: 'xl',
    render: (row) =>
      row.es_alquilable ? (
        <span className="tabular-nums">{formatArsCompact(row.tarifa_dia_ars)}</span>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>No alquilable</span>
      ),
    sortValue: (row) => row.tarifa_dia_ars,
  },
  {
    key: 'valor_ars',
    header: 'Valor',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.valor_ars)}</span>,
    sortValue: (row) => row.valor_ars,
  },
]

const AVAILABILITY_COLUMNS: readonly Column<EquipoDisponibilidad>[] = [
  {
    key: 'categoria',
    header: 'Categoría',
    render: (row) => describe(EQUIPMENT_CATEGORY, row.categoria).label,
    sortValue: (row) => row.categoria,
    searchValue: (row) => row.categoria,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(EQUIPMENT_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'cantidad',
    header: 'Cantidad',
    align: 'right',
    render: (row) => formatInteger(row.cantidad),
    sortValue: (row) => row.cantidad,
  },
  {
    key: 'alquilables',
    header: 'Alquilables',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => formatInteger(row.alquilables),
    sortValue: (row) => row.alquilables,
  },
  {
    key: 'calibraciones_vencidas',
    header: 'Calibraciones vencidas',
    align: 'right',
    render: (row) =>
      (row.calibraciones_vencidas ?? 0) > 0 ? (
        <Pill tone="critical">{formatInteger(row.calibraciones_vencidas)}</Pill>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>0</span>
      ),
    sortValue: (row) => row.calibraciones_vencidas,
  },
  {
    key: 'calibraciones_por_vencer_30d',
    header: 'Vencen en 30 días',
    align: 'right',
    hideBelow: 'md',
    render: (row) =>
      (row.calibraciones_por_vencer_30d ?? 0) > 0 ? (
        <Pill tone="warning">{formatInteger(row.calibraciones_por_vencer_30d)}</Pill>
      ) : (
        <span style={{ color: 'var(--label-tertiary)' }}>0</span>
      ),
    sortValue: (row) => row.calibraciones_por_vencer_30d,
  },
  {
    key: 'servicios_asociados',
    header: 'Servicios asociados',
    hideBelow: 'xl',
    render: (row) => (
      <span className="line-clamp-2" style={{ color: 'var(--label-secondary)' }}>
        {row.servicios_asociados ?? EMPTY}
      </span>
    ),
    searchValue: (row) => row.servicios_asociados ?? '',
  },
  {
    key: 'valor_total_ars',
    header: 'Valor total',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.valor_total_ars)}</span>,
    sortValue: (row) => row.valor_total_ars,
  },
]

export function EquipmentModule() {
  const { primary: equipment, secondary: availability, loading, error, reload } = useViews2<
    Equipo,
    EquipoDisponibilidad
  >('gd_equipos', 'gd_equipos_disponibilidad')
  const [tab, setTab] = useState('parque')

  const summary = useMemo(() => {
    const available = equipment.filter((row) => row.estado === 'disponible').length
    const overdue = equipment.filter((row) => row.calibracion_vencida === true).length
    const outOfService = equipment.filter((row) => row.estado === 'fuera_servicio').length
    const value = equipment.reduce((sum, row) => sum + (row.valor_ars ?? 0), 0)
    return { available, overdue, outOfService, value }
  }, [equipment])

  return (
    <ModuleShell
      title="Equipos y herramientas"
      description="Parque de equipos, disponibilidad por categoría y vencimientos de calibración."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Equipos disponibles"
          value={`${formatInteger(summary.available)} / ${formatInteger(equipment.length)}`}
          hint="Listos para asignar"
          tone="positive"
          loading={loading}
        />
        <StatCard
          label="Calibraciones vencidas"
          value={formatInteger(summary.overdue)}
          hint="No pueden usarse en faena"
          tone={summary.overdue > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Fuera de servicio"
          value={formatInteger(summary.outOfService)}
          hint="Requieren reparación o baja"
          tone={summary.outOfService > 0 ? 'warning' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Valor del parque"
          value={formatArsCompact(summary.value)}
          hint="Suma del valor de los equipos"
          tone="accent"
          loading={loading}
        />
      </StatGrid>

      <Tabs value={tab} onValueChange={setTab}>
        {/* Sized for a finger: the demo runs on a tablet, and the default
            shadcn tab strip is 28px tall. */}
        <TabsList className="h-12">
          <TabsTrigger className="h-10 px-4" value="parque">
            Parque de equipos
          </TabsTrigger>
          <TabsTrigger className="h-10 px-4" value="disponibilidad">
            Disponibilidad por categoría
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parque" className="mt-3">
          <DataTable
            rows={equipment}
            columns={EQUIPMENT_COLUMNS}
            getRowId={(row) => String(row.equipo_id)}
            loading={loading}
            initialSort={{ key: 'proxima_calibracion', direction: 'asc' }}
            searchPlaceholder="Buscar por equipo, código, marca o depósito…"
            emptyMessage="Todavía no hay equipos cargados."
            rowAccent={(row) =>
              row.calibracion_vencida
                ? 'var(--sys-red)'
                : row.estado === 'fuera_servicio'
                  ? 'var(--sys-orange)'
                  : null
            }
          />
        </TabsContent>

        <TabsContent value="disponibilidad" className="mt-3">
          <DataTable
            rows={availability}
            columns={AVAILABILITY_COLUMNS}
            getRowId={(row, index) => `${row.categoria}-${row.estado}-${index}`}
            loading={loading}
            pageSize={20}
            initialSort={{ key: 'cantidad', direction: 'desc' }}
            searchPlaceholder="Buscar por categoría o estado…"
            emptyMessage="Todavía no hay equipos para agrupar."
            rowAccent={(row) => ((row.calibraciones_vencidas ?? 0) > 0 ? 'var(--sys-red)' : null)}
          />
        </TabsContent>
      </Tabs>
    </ModuleShell>
  )
}
