'use client'

/**
 * Quotes module — grid over `gd_cotizaciones` plus the funnel from
 * `gd_pipeline_cotizaciones`.
 *
 * The funnel is rendered as a strip of stage cards rather than a chart: it has
 * six ordered stages and both a count and a weighted amount per stage, which a
 * card conveys precisely. Charts are day 3 work.
 */

import { DataTable, type Column } from '@/core/ui/table'
import { ModuleSection, ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { useViews2 } from '@/features/gannet/useView'
import { QUOTE_STATE, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDate,
  formatInteger,
  formatPercent,
} from '@/features/gannet/format'
import { TONE_COLOR } from '@/features/gannet/tone'
import type { Cotizacion, PipelineCotizaciones } from '@/features/gannet/types'

const COLUMNS: readonly Column<Cotizacion>[] = [
  {
    key: 'numero',
    header: 'Número',
    render: (row) => <span className="tabular-nums">{row.numero}</span>,
    sortValue: (row) => row.numero,
    searchValue: (row) => row.numero,
  },
  {
    key: 'cliente',
    header: 'Cliente',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.cliente ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.servicio_principal ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.cliente,
    searchValue: (row) => `${row.cliente ?? ''} ${row.servicio_principal ?? ''} ${row.proyecto ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(QUOTE_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado,
  },
  {
    key: 'responsable_comercial',
    header: 'Responsable',
    hideBelow: 'xl',
    render: (row) => row.responsable_comercial ?? EMPTY,
    sortValue: (row) => row.responsable_comercial,
    searchValue: (row) => row.responsable_comercial ?? '',
  },
  {
    key: 'fecha_emision',
    header: 'Emisión',
    hideBelow: 'md',
    render: (row) => formatDate(row.fecha_emision),
    sortValue: (row) => row.fecha_emision,
  },
  {
    key: 'fecha_validez',
    header: 'Validez',
    hideBelow: 'lg',
    render: (row) =>
      row.fuera_de_validez ? (
        <Pill tone="critical" title="La cotización superó su fecha de validez">
          Fuera de validez
        </Pill>
      ) : (
        formatDate(row.fecha_validez)
      ),
    sortValue: (row) => row.fecha_validez,
  },
  {
    key: 'probabilidad_pct',
    header: 'Probabilidad',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => formatPercent(row.probabilidad_pct, 0),
    sortValue: (row) => row.probabilidad_pct,
  },
  {
    key: 'total_ars',
    header: 'Total',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.total_ars)}</span>,
    sortValue: (row) => row.total_ars,
  },
  {
    key: 'total_ponderado_ars',
    header: 'Ponderado',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => (
      <span className="tabular-nums" style={{ color: 'var(--label-secondary)' }}>
        {formatArsCompact(row.total_ponderado_ars)}
      </span>
    ),
    sortValue: (row) => row.total_ponderado_ars,
  },
]

export function QuotesModule() {
  const { primary: quotes, secondary: funnel, loading, error, reload } = useViews2<
    Cotizacion,
    PipelineCotizaciones
  >('gd_cotizaciones', 'gd_pipeline_cotizaciones')

  return (
    <ModuleShell
      title="Cotizaciones"
      description="Embudo comercial por estado y detalle de cada cotización emitida."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <ModuleSection
        title="Embudo comercial"
        description="Cantidad, monto nominal y monto ponderado por probabilidad en cada etapa."
      >
        {funnel.length === 0 && !loading ? (
          <p
            className="mc-card rounded-card px-4 py-8 text-center text-callout"
            style={{ color: 'var(--label-tertiary)' }}
          >
            Todavía no hay cotizaciones para armar el embudo.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {funnel.map((stage) => {
              const state = describe(QUOTE_STATE, stage.estado)
              const color = TONE_COLOR[state.tone]
              return (
                <article
                  key={stage.estado}
                  className="mc-card flex flex-col gap-1 rounded-card p-3"
                  style={{ borderTop: `2px solid ${color}` }}
                >
                  <h3 className="text-caption1" style={{ color: 'var(--label-secondary)' }}>
                    {stage.etiqueta ?? state.label}
                  </h3>
                  <p className="text-title3 tabular-nums" style={{ color }}>
                    {formatInteger(stage.cantidad)}
                  </p>
                  <p className="text-caption2 tabular-nums" style={{ color: 'var(--label-primary)' }}>
                    {formatArsCompact(stage.monto_nominal_ars)}
                  </p>
                  <p className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
                    Ponderado {formatArsCompact(stage.monto_ponderado_ars)}
                  </p>
                  {(stage.fuera_de_validez ?? 0) > 0 && (
                    <p className="text-caption2" style={{ color: 'var(--sys-orange)' }}>
                      {formatInteger(stage.fuera_de_validez)} fuera de validez
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </ModuleSection>

      <ModuleSection title="Cotizaciones emitidas">
        <DataTable
          rows={quotes}
          columns={COLUMNS}
          getRowId={(row) => String(row.cotizacion_id)}
          loading={loading}
          initialSort={{ key: 'fecha_emision', direction: 'desc' }}
          searchPlaceholder="Buscar por número, cliente o servicio…"
          emptyMessage="Todavía no hay cotizaciones cargadas."
          rowAccent={(row) => (row.fuera_de_validez ? 'var(--sys-orange)' : null)}
        />
      </ModuleSection>
    </ModuleShell>
  )
}
