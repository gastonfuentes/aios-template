'use client'

/**
 * Stock module — catalogue from `gd_articulos` with the critical shortages from
 * `gd_stock_critico` promoted above it.
 *
 * The shortage grid comes first and is always visible rather than living behind
 * a tab: it is the seeded signal the presenter points at, and burying it would
 * defeat the purpose.
 */

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleSection, ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useViews2 } from '@/features/gannet/useView'
import { ARTICLE_CATEGORY, WAREHOUSE_TYPE, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArsCompact,
  formatDateTime,
  formatInteger,
  formatPercent,
  formatQuantity,
} from '@/features/gannet/format'
import { toneForCoverage } from '@/features/gannet/tone'
import type { Articulo, StockCritico } from '@/features/gannet/types'

const CRITICAL_COLUMNS: readonly Column<StockCritico>[] = [
  {
    key: 'articulo',
    header: 'Artículo',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.articulo}
        </div>
        <div className="truncate text-caption2 tabular-nums" style={{ color: 'var(--label-tertiary)' }}>
          {row.articulo_codigo} · {describe(ARTICLE_CATEGORY, row.articulo_categoria).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.articulo,
    searchValue: (row) => `${row.articulo} ${row.articulo_codigo} ${row.articulo_categoria ?? ''}`,
  },
  {
    key: 'deposito',
    header: 'Depósito',
    hideBelow: 'md',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate">{row.deposito ?? EMPTY}</div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {describe(WAREHOUSE_TYPE, row.deposito_tipo).label}
        </div>
      </div>
    ),
    sortValue: (row) => row.deposito,
    searchValue: (row) => `${row.deposito ?? ''} ${row.deposito_responsable ?? ''}`,
  },
  {
    key: 'cantidad_actual',
    header: 'Existencia',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">{formatQuantity(row.cantidad_actual, row.unidad_medida)}</span>
    ),
    sortValue: (row) => row.cantidad_actual,
  },
  {
    key: 'stock_minimo',
    header: 'Mínimo',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => <span className="tabular-nums">{formatQuantity(row.stock_minimo)}</span>,
    sortValue: (row) => row.stock_minimo,
  },
  {
    key: 'cobertura_pct',
    header: 'Cobertura',
    align: 'right',
    render: (row) => {
      if (row.sin_existencia) return <Pill tone="critical">Sin existencia</Pill>
      return <Pill tone={toneForCoverage(row.cobertura_pct)}>{formatPercent(row.cobertura_pct)}</Pill>
    },
    sortValue: (row) => row.cobertura_pct,
  },
  {
    key: 'faltante',
    header: 'Faltante',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => <span className="tabular-nums">{formatQuantity(row.faltante)}</span>,
    sortValue: (row) => row.faltante,
  },
  {
    key: 'compras_en_curso',
    header: 'Compras en curso',
    align: 'right',
    hideBelow: 'lg',
    render: (row) =>
      (row.compras_en_curso ?? 0) > 0 ? (
        <Pill tone="info">{formatInteger(row.compras_en_curso)}</Pill>
      ) : (
        <span style={{ color: 'var(--sys-orange)' }}>Sin reposición</span>
      ),
    sortValue: (row) => row.compras_en_curso,
  },
  {
    key: 'costo_reposicion_ars',
    header: 'Costo de reposición',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">{formatArsCompact(row.costo_reposicion_ars)}</span>
    ),
    sortValue: (row) => row.costo_reposicion_ars,
  },
]

const ARTICLE_COLUMNS: readonly Column<Articulo>[] = [
  {
    key: 'articulo',
    header: 'Artículo',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.articulo}
        </div>
        <div className="truncate text-caption2 tabular-nums" style={{ color: 'var(--label-tertiary)' }}>
          {row.codigo}
        </div>
      </div>
    ),
    sortValue: (row) => row.articulo,
    searchValue: (row) => `${row.articulo} ${row.codigo}`,
  },
  {
    key: 'categoria',
    header: 'Categoría',
    hideBelow: 'sm',
    render: (row) => describe(ARTICLE_CATEGORY, row.categoria).label,
    sortValue: (row) => row.categoria,
    searchValue: (row) => row.categoria ?? '',
  },
  {
    key: 'stock_total',
    header: 'Existencia total',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">{formatQuantity(row.stock_total, row.unidad_medida)}</span>
    ),
    sortValue: (row) => row.stock_total,
  },
  {
    key: 'stock_minimo',
    header: 'Mínimo',
    align: 'right',
    hideBelow: 'md',
    render: (row) => <span className="tabular-nums">{formatQuantity(row.stock_minimo)}</span>,
    sortValue: (row) => row.stock_minimo,
  },
  {
    key: 'bajo_minimo',
    header: 'Situación',
    render: (row) =>
      row.bajo_minimo ? (
        <Pill tone="critical">Bajo mínimo</Pill>
      ) : (
        <Pill tone="positive">En nivel</Pill>
      ),
    sortValue: (row) => row.bajo_minimo,
  },
  {
    key: 'depositos_con_stock',
    header: 'Depósitos',
    align: 'right',
    hideBelow: 'lg',
    render: (row) => formatInteger(row.depositos_con_stock),
    sortValue: (row) => row.depositos_con_stock,
  },
  {
    key: 'ultimo_movimiento_en',
    header: 'Último movimiento',
    hideBelow: 'xl',
    render: (row) => formatDateTime(row.ultimo_movimiento_en),
    sortValue: (row) => row.ultimo_movimiento_en,
  },
  {
    key: 'valorizado_ars',
    header: 'Valorizado',
    align: 'right',
    render: (row) => <span className="tabular-nums">{formatArsCompact(row.valorizado_ars)}</span>,
    sortValue: (row) => row.valorizado_ars,
  },
]

export function StockModule() {
  const { primary: articles, secondary: critical, loading, error, reload } = useViews2<
    Articulo,
    StockCritico
  >('gd_articulos', 'gd_stock_critico')

  const summary = useMemo(() => {
    const valued = articles.reduce((sum, row) => sum + (row.valorizado_ars ?? 0), 0)
    const belowMinimum = articles.filter((row) => row.bajo_minimo).length
    const outOfStock = critical.filter((row) => row.sin_existencia).length
    const replacement = critical.reduce((sum, row) => sum + (row.costo_reposicion_ars ?? 0), 0)
    return { valued, belowMinimum, outOfStock, replacement }
  }, [articles, critical])

  return (
    <ModuleShell
      title="Stock y almacenes"
      description="Catálogo de artículos valorizado y alertas de reposición por depósito."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <StatGrid>
        <StatCard
          label="Artículos en catálogo"
          value={formatInteger(articles.length)}
          hint={`${formatInteger(summary.belowMinimum)} bajo mínimo`}
          tone="info"
          loading={loading}
        />
        <StatCard
          label="Posiciones críticas"
          value={formatInteger(critical.length)}
          hint={`${formatInteger(summary.outOfStock)} sin existencia`}
          tone={critical.length > 0 ? 'critical' : 'positive'}
          icon={<AlertTriangle size={14} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Stock valorizado"
          value={formatArsCompact(summary.valued)}
          hint="Existencia total a costo"
          tone="positive"
          loading={loading}
        />
        <StatCard
          label="Costo de reposición"
          value={formatArsCompact(summary.replacement)}
          hint="Para cubrir todos los faltantes"
          tone="warning"
          loading={loading}
        />
      </StatGrid>

      <ModuleSection
        title="Stock crítico"
        description="Posiciones por debajo del mínimo definido, ordenadas por menor cobertura."
      >
        <DataTable
          rows={critical}
          columns={CRITICAL_COLUMNS}
          getRowId={(row) => String(row.stock_id)}
          loading={loading}
          pageSize={15}
          initialSort={{ key: 'cobertura_pct', direction: 'asc' }}
          searchPlaceholder="Buscar por artículo o depósito…"
          emptyMessage="No hay posiciones por debajo del mínimo."
          rowAccent={(row) => (row.sin_existencia ? 'var(--sys-red)' : 'var(--sys-orange)')}
        />
      </ModuleSection>

      <ModuleSection title="Catálogo de artículos">
        <DataTable
          rows={articles}
          columns={ARTICLE_COLUMNS}
          getRowId={(row) => String(row.articulo_id)}
          loading={loading}
          initialSort={{ key: 'valorizado_ars', direction: 'desc' }}
          searchPlaceholder="Buscar por artículo, código o categoría…"
          emptyMessage="Todavía no hay artículos cargados."
          rowAccent={(row) => (row.bajo_minimo ? 'var(--sys-orange)' : null)}
        />
      </ModuleSection>
    </ModuleShell>
  )
}
