'use client'

/**
 * Invoicing module — invoices from `gd_facturas` with the receivables aging from
 * `gd_cobranzas_aging`.
 *
 * Aging is rolled up by bucket for the headline strip and shown per client
 * underneath, because the sales narrative is "who owes us and how late", not
 * "how much is in the 61-90 bucket in the abstract".
 *
 * The demo deliberately carries a high level of overdue receivables; that is a
 * reviewed decision recorded in `docs/demo-congreso-minero.md` and is not
 * something this module should soften.
 */

import { useMemo } from 'react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleSection, ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useViews2 } from '@/features/gannet/useView'
import { AGING_BUCKET, INVOICE_STATE, INVOICE_TYPE, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDate,
  formatInteger,
} from '@/features/gannet/format'
import { TONE_COLOR } from '@/features/gannet/tone'
import type { CobranzaAging, Factura } from '@/features/gannet/types'

const INVOICE_COLUMNS: readonly Column<Factura>[] = [
  {
    key: 'numero',
    header: 'Comprobante',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate tabular-nums" style={{ color: 'var(--label-primary)' }}>
          {row.numero}
        </div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(INVOICE_TYPE, row.tipo_comprobante).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.numero,
    searchValue: (row) => `${row.numero} ${row.tipo_comprobante ?? ''}`,
  },
  {
    key: 'cliente',
    header: 'Cliente',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.cliente ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.proyecto ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.cliente,
    searchValue: (row) => `${row.cliente ?? ''} ${row.proyecto ?? ''} ${row.ot_numero ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(INVOICE_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'fecha_emision',
    header: 'Emisión',
    hideBelow: 'lg',
    render: (row) => formatDate(row.fecha_emision),
    sortValue: (row) => row.fecha_emision,
  },
  {
    key: 'fecha_vencimiento',
    header: 'Vencimiento',
    hideBelow: 'sm',
    render: (row) => formatDate(row.fecha_vencimiento),
    sortValue: (row) => row.fecha_vencimiento,
  },
  {
    key: 'dias_vencido',
    header: 'Mora',
    align: 'right',
    render: (row) => {
      if (row.esta_pendiente !== true) {
        return <span style={{ color: 'var(--label-tertiary)' }}>{EMPTY}</span>
      }
      const overdue = row.dias_vencido
      if (overdue === null || overdue <= 0) {
        return <span style={{ color: 'var(--label-tertiary)' }}>En término</span>
      }
      return <Pill tone={overdue > 90 ? 'critical' : 'warning'}>{`${formatInteger(overdue)} d`}</Pill>
    },
    sortValue: (row) => row.dias_vencido,
  },
  {
    key: 'fecha_cobro',
    header: 'Cobro',
    hideBelow: 'xl',
    render: (row) => formatDate(row.fecha_cobro),
    sortValue: (row) => row.fecha_cobro,
  },
  {
    key: 'neto_ars',
    header: 'Neto',
    align: 'right',
    hideBelow: 'xl',
    render: (row) => (
      <span className="tabular-nums" style={{ color: 'var(--label-secondary)' }}>
        {formatArsCompact(row.neto_ars)}
      </span>
    ),
    sortValue: (row) => row.neto_ars,
  },
  {
    key: 'total_ars',
    header: 'Total',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.total_ars)}</span>,
    sortValue: (row) => row.total_ars,
  },
]

const AGING_COLUMNS: readonly Column<CobranzaAging>[] = [
  {
    key: 'cliente',
    header: 'Cliente',
    render: (row) => row.cliente,
    sortValue: (row) => row.cliente,
    searchValue: (row) => row.cliente,
  },
  {
    key: 'tramo',
    header: 'Tramo',
    render: (row) => {
      const bucket = describe(AGING_BUCKET, row.tramo)
      return <Pill tone={bucket.tone}>{row.etiqueta_tramo ?? bucket.label}</Pill>
    },
    sortValue: (row) => row.orden_tramo,
    searchValue: (row) => row.tramo,
  },
  {
    key: 'facturas',
    header: 'Facturas',
    align: 'right',
    render: (row) => formatInteger(row.facturas),
    sortValue: (row) => row.facturas,
  },
  {
    key: 'dias_vencido_promedio',
    header: 'Mora promedio',
    align: 'right',
    hideBelow: 'md',
    render: (row) =>
      row.dias_vencido_promedio === null
        ? EMPTY
        : `${formatInteger(row.dias_vencido_promedio)} d`,
    sortValue: (row) => row.dias_vencido_promedio,
  },
  {
    key: 'dias_vencido_maximo',
    header: 'Mora máxima',
    align: 'right',
    hideBelow: 'lg',
    render: (row) =>
      row.dias_vencido_maximo === null ? EMPTY : `${formatInteger(row.dias_vencido_maximo)} d`,
    sortValue: (row) => row.dias_vencido_maximo,
  },
  {
    key: 'vencimiento_mas_antiguo',
    header: 'Vencimiento más antiguo',
    hideBelow: 'xl',
    render: (row) => formatDate(row.vencimiento_mas_antiguo),
    sortValue: (row) => row.vencimiento_mas_antiguo,
  },
  {
    key: 'monto_ars',
    header: 'Monto',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.monto_ars)}</span>,
    sortValue: (row) => row.monto_ars,
  },
]

export function InvoicingModule() {
  const { primary: invoices, secondary: aging, loading, error, reload } = useViews2<
    Factura,
    CobranzaAging
  >('gd_facturas', 'gd_cobranzas_aging')

  const summary = useMemo(() => {
    const pending = invoices.filter((row) => row.esta_pendiente === true)
    const pendingAmount = pending.reduce((sum, row) => sum + (row.total_ars ?? 0), 0)
    const overdue = pending.filter((row) => (row.dias_vencido ?? 0) > 0)
    const overdueAmount = overdue.reduce((sum, row) => sum + (row.total_ars ?? 0), 0)
    const collected = invoices
      .filter((row) => row.estado === 'cobrada')
      .reduce((sum, row) => sum + (row.total_ars ?? 0), 0)
    return {
      pendingCount: pending.length,
      pendingAmount,
      overdueCount: overdue.length,
      overdueAmount,
      collected,
    }
  }, [invoices])

  // Aging is stored per client and per bucket; the strip needs it per bucket.
  const buckets = useMemo(() => {
    const totals = new Map<string, { order: number; amount: number; invoices: number }>()
    for (const row of aging) {
      const current = totals.get(row.tramo) ?? { order: row.orden_tramo ?? 0, amount: 0, invoices: 0 }
      current.amount += row.monto_ars ?? 0
      current.invoices += row.facturas ?? 0
      totals.set(row.tramo, current)
    }
    return [...totals.entries()]
      .map(([tramo, value]) => ({ tramo, ...value }))
      .sort((a, b) => a.order - b.order)
  }, [aging])

  return (
    <ModuleShell
      title="Facturación y cobranzas"
      description="Comprobantes emitidos, situación de cobro y antigüedad de la deuda por cliente."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Comprobantes emitidos"
          value={formatInteger(invoices.length)}
          hint={`${formatInteger(summary.pendingCount)} pendientes de cobro`}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Cobranza pendiente"
          value={formatArsCompact(summary.pendingAmount)}
          hint="Emitido y no cobrado"
          tone="warning"
          loading={loading}
        />
        <StatCard
          label="Cobranza vencida"
          value={formatArsCompact(summary.overdueAmount)}
          hint={`${formatInteger(summary.overdueCount)} facturas fuera de término`}
          tone="critical"
          loading={loading}
        />
        <StatCard
          label="Cobrado"
          value={formatArsCompact(summary.collected)}
          hint="Comprobantes con cobro registrado"
          tone="positive"
          loading={loading}
        />
      </StatGrid>

      <ModuleSection
        title="Antigüedad de la deuda"
        description="Distribución del saldo pendiente por tramo de mora."
      >
        {buckets.length === 0 && !loading ? (
          <p
            className="mc-card rounded-card px-4 py-8 text-center text-callout"
            style={{ color: 'var(--label-tertiary)' }}
          >
            No hay saldo pendiente para distribuir.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {buckets.map((bucket) => {
              const spec = describe(AGING_BUCKET, bucket.tramo)
              const color = TONE_COLOR[spec.tone]
              return (
                <article
                  key={bucket.tramo}
                  className="mc-card flex flex-col gap-1 rounded-card p-3"
                  style={{ borderTop: `2px solid ${color}` }}
                >
                  <h3 className="text-caption1" style={{ color: 'var(--label-secondary)' }}>
                    {spec.label}
                  </h3>
                  <p className="text-title3 tabular-nums" style={{ color }}>
                    {formatArsCompact(bucket.amount)}
                  </p>
                  <p className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
                    {formatInteger(bucket.invoices)} facturas
                  </p>
                </article>
              )
            })}
          </div>
        )}

        <DataTable
          rows={aging}
          columns={AGING_COLUMNS}
          getRowId={(row) => `${row.cliente_id}-${row.tramo}`}
          loading={loading}
          pageSize={15}
          initialSort={{ key: 'monto_ars', direction: 'desc' }}
          searchPlaceholder="Buscar por cliente…"
          emptyMessage="No hay deuda registrada."
          rowAccent={(row) => (row.tramo === '+90' ? 'var(--sys-red)' : null)}
        />
      </ModuleSection>

      <ModuleSection title="Comprobantes emitidos">
        <DataTable
          rows={invoices}
          columns={INVOICE_COLUMNS}
          getRowId={(row) => String(row.factura_id)}
          loading={loading}
          pageSize={30}
          initialSort={{ key: 'fecha_emision', direction: 'desc' }}
          searchPlaceholder="Buscar por comprobante, cliente o proyecto…"
          emptyMessage="Todavía no hay comprobantes cargados."
          rowAccent={(row) =>
            row.esta_pendiente && (row.dias_vencido ?? 0) > 0 ? 'var(--sys-red)' : null
          }
        />
      </ModuleSection>
    </ModuleShell>
  )
}
