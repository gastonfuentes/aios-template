'use client'

/**
 * Purchasing module — purchase orders from `gd_ordenes_compra` plus supplier
 * performance from `gd_compras_por_proveedor`.
 *
 * Two grids in tabs rather than stacked: both are dense and equally important,
 * and stacking them would push the supplier table below the fold on a laptop.
 */

import { useMemo, useState } from 'react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/ui/tabs'
import { useViews2 } from '@/features/gannet/useView'
import { PURCHASE_ORDER_STATE, SUPPLIER_CATEGORY, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDate,
  formatDecimal,
  formatInteger,
  formatPercent,
} from '@/features/gannet/format'
import type { CompraPorProveedor, OrdenCompra } from '@/features/gannet/types'

const ORDER_COLUMNS: readonly Column<OrdenCompra>[] = [
  {
    key: 'numero',
    header: 'Número',
    render: (row) => <span className="tabular-nums">{row.numero}</span>,
    sortValue: (row) => row.numero,
    searchValue: (row) => row.numero,
  },
  {
    key: 'proveedor',
    header: 'Proveedor',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.proveedor ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(SUPPLIER_CATEGORY, row.proveedor_rubro).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.proveedor,
    searchValue: (row) => `${row.proveedor ?? ''} ${row.proveedor_rubro ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(PURCHASE_ORDER_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'proyecto',
    header: 'Destino',
    hideBelow: 'lg',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.proyecto ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.deposito_destino ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.proyecto,
    searchValue: (row) => `${row.proyecto ?? ''} ${row.deposito_destino ?? ''} ${row.ot_numero ?? ''}`,
  },
  {
    key: 'solicitante',
    header: 'Solicitante',
    hideBelow: 'xl',
    render: (row) => row.solicitante ?? EMPTY,
    sortValue: (row) => row.solicitante,
    searchValue: (row) => row.solicitante ?? '',
  },
  {
    key: 'fecha_emision',
    header: 'Emisión',
    hideBelow: 'md',
    render: (row) => formatDate(row.fecha_emision),
    sortValue: (row) => row.fecha_emision,
  },
  {
    key: 'fecha_entrega_estimada',
    header: 'Entrega',
    hideBelow: 'sm',
    render: (row) =>
      row.entrega_atrasada ? (
        <Pill tone="critical" title="La entrega superó la fecha estimada">
          {formatDate(row.fecha_entrega_estimada)}
        </Pill>
      ) : (
        formatDate(row.fecha_entrega_estimada)
      ),
    sortValue: (row) => row.fecha_entrega_estimada,
  },
  {
    key: 'items',
    header: 'Ítems',
    align: 'right',
    hideBelow: 'xl',
    render: (row) => formatInteger(row.items),
    sortValue: (row) => row.items,
  },
  {
    key: 'total_ars',
    header: 'Total',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.total_ars)}</span>,
    sortValue: (row) => row.total_ars,
  },
]

const SUPPLIER_COLUMNS: readonly Column<CompraPorProveedor>[] = [
  {
    key: 'proveedor',
    header: 'Proveedor',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.proveedor}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(SUPPLIER_CATEGORY, row.rubro).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.proveedor,
    searchValue: (row) => `${row.proveedor} ${row.rubro ?? ''}`,
  },
  {
    key: 'activo',
    header: 'Situación',
    render: (row) =>
      row.activo ? <Pill tone="positive">Activo</Pill> : <Pill tone="neutral">Inactivo</Pill>,
    sortValue: (row) => row.activo,
  },
  {
    key: 'calificacion',
    header: 'Calificación',
    align: 'right',
    hideBelow: 'md',
    render: (row) => (row.calificacion === null ? EMPTY : `${row.calificacion} / 5`),
    sortValue: (row) => row.calificacion,
  },
  {
    key: 'oc_total',
    header: 'OC emitidas',
    align: 'right',
    render: (row) => `${formatInteger(row.oc_en_curso)} en curso / ${formatInteger(row.oc_total)}`,
    sortValue: (row) => row.oc_total,
  },
  {
    key: 'cumplimiento_plazo_pct',
    header: 'Cumplimiento de plazo',
    align: 'right',
    render: (row) => {
      const value = row.cumplimiento_plazo_pct
      const tone = value === null ? 'neutral' : value >= 80 ? 'positive' : value >= 50 ? 'warning' : 'critical'
      return <Pill tone={tone}>{formatPercent(value)}</Pill>
    },
    sortValue: (row) => row.cumplimiento_plazo_pct,
  },
  {
    key: 'dias_desvio_promedio',
    header: 'Desvío medio',
    align: 'right',
    hideBelow: 'lg',
    render: (row) =>
      row.dias_desvio_promedio === null ? EMPTY : `${formatDecimal(row.dias_desvio_promedio)} d`,
    sortValue: (row) => row.dias_desvio_promedio,
  },
  {
    key: 'ultima_compra_el',
    header: 'Última compra',
    hideBelow: 'xl',
    render: (row) => formatDate(row.ultima_compra_el),
    sortValue: (row) => row.ultima_compra_el,
  },
  {
    key: 'monto_total_ars',
    header: 'Comprado',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.monto_total_ars)}</span>,
    sortValue: (row) => row.monto_total_ars,
  },
]

export function PurchasingModule() {
  const { primary: orders, secondary: suppliers, loading, error, reload } = useViews2<
    OrdenCompra,
    CompraPorProveedor
  >('gd_ordenes_compra', 'gd_compras_por_proveedor')
  const [tab, setTab] = useState('ordenes')

  const summary = useMemo(() => {
    const inProgress = orders.filter((row) => row.estado !== 'recibida' && row.estado !== 'cancelada')
    const late = orders.filter((row) => row.entrega_atrasada === true)
    const total = orders.reduce((sum, row) => sum + (row.total_ars ?? 0), 0)
    return { inProgress: inProgress.length, late: late.length, total }
  }, [orders])

  return (
    <ModuleShell
      title="Compras"
      description="Órdenes de compra emitidas a proveedores y desempeño de entrega de cada proveedor."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Órdenes emitidas"
          value={formatInteger(orders.length)}
          hint={`${formatInteger(summary.inProgress)} sin recepción completa`}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Entregas atrasadas"
          value={formatInteger(summary.late)}
          hint="Superaron la fecha estimada"
          tone={summary.late > 0 ? 'critical' : 'positive'}
          loading={loading}
        />
        <StatCard
          label="Proveedores activos"
          value={formatInteger(suppliers.filter((row) => row.activo).length)}
          hint={`${formatInteger(suppliers.length)} en el padrón`}
          tone="neutral"
          loading={loading}
        />
        <StatCard
          label="Monto comprado"
          value={formatArsCompact(summary.total)}
          hint="Suma de órdenes emitidas"
          tone="accent"
          loading={loading}
        />
      </StatGrid>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="ordenes">Órdenes de compra</TabsTrigger>
          <TabsTrigger value="proveedores">Desempeño de proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="ordenes" className="mt-3">
          <DataTable
            rows={orders}
            columns={ORDER_COLUMNS}
            getRowId={(row) => String(row.orden_compra_id)}
            loading={loading}
            initialSort={{ key: 'fecha_emision', direction: 'desc' }}
            searchPlaceholder="Buscar por número, proveedor o destino…"
            emptyMessage="Todavía no hay órdenes de compra cargadas."
            rowAccent={(row) => (row.entrega_atrasada ? 'var(--sys-red)' : null)}
          />
        </TabsContent>

        <TabsContent value="proveedores" className="mt-3">
          <DataTable
            rows={suppliers}
            columns={SUPPLIER_COLUMNS}
            getRowId={(row) => String(row.proveedor_id)}
            loading={loading}
            initialSort={{ key: 'monto_total_ars', direction: 'desc' }}
            searchPlaceholder="Buscar por proveedor o rubro…"
            emptyMessage="Todavía no hay proveedores con compras registradas."
            rowAccent={(row) =>
              (row.cumplimiento_plazo_pct ?? 100) < 50 ? 'var(--sys-orange)' : null
            }
          />
        </TabsContent>
      </Tabs>
    </ModuleShell>
  )
}
