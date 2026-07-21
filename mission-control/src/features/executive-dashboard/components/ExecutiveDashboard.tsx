'use client'

/**
 * Executive dashboard — one hero banner, three KPI bands, four charts.
 *
 * Composed for the fold, not for the scroll. This is the opening screen of a
 * three-minute pitch given on a tablet in landscape (1024x768), so the first
 * screenful has to answer "how is the company doing" on its own: the headline
 * figure, the four commercial KPIs, and the billing-evolution chart all land
 * above the fold. Everything after it is the second beat of the narration.
 *
 * Reading order is the narration order: the presenter opens on the overdue
 * receivable (the single hero number), reads the commercial band beside it,
 * points at the emitted-vs-collected gap in the first chart, then walks the
 * composition charts — which service lines produced the money, which clients
 * owe it, how old that debt is — and closes on operations and resources. The
 * client ranking is clickable and is the hand-off into the operational
 * drill-down.
 *
 * Spacing is owned here through a single wrapper instead of handing `ModuleShell`
 * one child per block: the shell separates its children with a 20px gap, which
 * across seven blocks costs more vertical room than the fold can spare.
 *
 * Five views are read in parallel rather than through `useViews2`, which only
 * pairs two. Each is independent and responds in single-digit milliseconds.
 */

import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import { useView } from '@/features/gannet/useView'
import {
  formatArs,
  formatArsCompact,
  formatDateTime,
  formatPercent,
} from '@/features/gannet/format'
import type {
  CobranzaAging,
  FacturacionMensual,
  IngresoPorServicio,
  KpiEjecutivo,
  RankingCliente,
} from '@/features/gannet/types'
import { ratio } from '../kpiMath'
import { ChartPaletteProvider } from './chartPalette'
import { CobranzaAgingChart } from './CobranzaAgingChart'
import { CommercialKpiBand, OperationalKpiBands } from './ExecutiveKpiBands'
import { FacturacionMensualChart } from './FacturacionMensualChart'
import { HeroFigure } from './HeroFigure'
import { IngresosPorServicioChart } from './IngresosPorServicioChart'
import { RankingClientesChart } from './RankingClientesChart'

export function ExecutiveDashboard() {
  const kpiView = useView<KpiEjecutivo>('gd_kpi_ejecutivo')
  const monthlyView = useView<FacturacionMensual>('gd_facturacion_mensual')
  const serviceView = useView<IngresoPorServicio>('gd_ingresos_por_servicio')
  const clientView = useView<RankingCliente>('gd_ranking_clientes')
  const agingView = useView<CobranzaAging>('gd_cobranzas_aging')

  const kpi = kpiView.rows[0]
  const loading =
    kpiView.loading ||
    monthlyView.loading ||
    serviceView.loading ||
    clientView.loading ||
    agingView.loading
  const error =
    kpiView.error ?? monthlyView.error ?? serviceView.error ?? clientView.error ?? agingView.error

  const reload = () => {
    kpiView.reload()
    monthlyView.reload()
    serviceView.reload()
    clientView.reload()
    agingView.reload()
  }

  return (
    <ModuleShell
      title="Dashboard ejecutivo"
      description={
        kpi?.calculado_en
          ? `Indicadores consolidados de Andes Servicios Integrales. Actualizado el ${formatDateTime(kpi.calculado_en)}.`
          : 'Indicadores consolidados de Andes Servicios Integrales.'
      }
      loading={loading}
      error={error}
      onReload={reload}
    >
      {!loading && error === null && kpi === undefined ? (
        <p
          className="mc-card rounded-card px-4 py-12 text-center text-callout"
          style={{ color: 'var(--label-tertiary)' }}
        >
          Todavía no hay indicadores calculados.
        </p>
      ) : (
        <ChartPaletteProvider>
          <div className="flex min-w-0 flex-col gap-4">
            <HeroFigure
              label="Cobranza vencida"
              value={formatArsCompact(kpi?.cobranza_vencida_ars)}
              hint={overdueHint(kpi)}
              detail={`${formatArs(kpi?.cobranza_vencida_ars)} fuera de término`}
              loading={kpiView.loading}
            />

            <CommercialKpiBand kpi={kpi} loading={kpiView.loading} />

            <FacturacionMensualChart rows={monthlyView.rows} />

            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              <IngresosPorServicioChart rows={serviceView.rows} />
              <RankingClientesChart rows={clientView.rows} />
            </div>

            <CobranzaAgingChart rows={agingView.rows} />

            <OperationalKpiBands kpi={kpi} loading={kpiView.loading} />
          </div>
        </ChartPaletteProvider>
      )}
    </ModuleShell>
  )
}

/**
 * Reading of the hero figure: how much of what is owed is already late.
 *
 * The share used to live on a duplicate "Cobranza vencida" tile in the
 * commercial band. The tile is gone; the reading it carried is not.
 */
function overdueHint(kpi: KpiEjecutivo | undefined): string {
  const share = ratio(kpi?.cobranza_vencida_ars, kpi?.cobranza_pendiente_ars)
  if (share === null) return 'Sobre el total de cobranza pendiente'
  return `${formatPercent(share)} de la cobranza pendiente`
}
