'use client'

/**
 * The KPI tile bands of the executive dashboard.
 *
 * Split out of `ExecutiveDashboard` when the charts landed: the dashboard now
 * orchestrates five views and five visuals, and twenty tiles of JSX inside it
 * made the composition impossible to read.
 *
 * Exported as two pieces rather than one, because they no longer sit together.
 * The opening screen is the hero banner, the commercial band and the first
 * chart; operations and resources come after the charts, once the presenter has
 * told the money story. Anything below the tablet fold is the second beat of the
 * narration, so it is the operational detail that goes there.
 *
 * Every figure appears exactly once across the board. Three tiles were dropped
 * when the hero shrank: overdue collections (it *is* the hero), year-to-date
 * billing (it was both a card and the hint of the monthly card) and orders in
 * execution (already the hint of open orders). A number the viewer meets twice
 * reads as two different measurements.
 */

import {
  AlertTriangle,
  Banknote,
  Boxes,
  ClipboardList,
  FolderKanban,
  HardHat,
  Percent,
  ReceiptText,
  ShieldAlert,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { ModuleSection } from '@/features/gannet/components/ModuleShell'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { formatArsCompact, formatInteger, formatPercent } from '@/features/gannet/format'
import type { KpiEjecutivo } from '@/features/gannet/types'
import type { Tone } from '@/features/gannet/tone'
import { ratio } from '../kpiMath'

const ICON_SIZE = 14

type BandProps = { kpi: KpiEjecutivo | undefined; loading: boolean }

/** Above the fold, next to the hero: how much money moved and how much is owed. */
export function CommercialKpiBand({ kpi, loading }: BandProps) {
  return (
    <ModuleSection title="Comercial y cobranzas">
      <StatGrid>
        <StatCard
          label="Facturación del mes"
          value={formatArsCompact(kpi?.facturacion_mes_ars)}
          hint="Emitido en el período"
          tone="positive"
          icon={<Banknote size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Facturación acumulada"
          value={formatArsCompact(kpi?.facturacion_ytd_ars)}
          hint="Ejercicio en curso"
          tone="positive"
          icon={<TrendingUp size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Cobranza pendiente"
          value={formatArsCompact(kpi?.cobranza_pendiente_ars)}
          hint={`${formatInteger(kpi?.facturas_pendientes)} facturas sin cobrar`}
          tone="warning"
          icon={<Wallet size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Pipeline abierto"
          value={formatArsCompact(kpi?.pipeline_abierto_ars)}
          hint={`Tasa de conversión: ${formatPercent(kpi?.tasa_conversion_pct)}`}
          tone="info"
          icon={<Percent size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
      </StatGrid>
    </ModuleSection>
  )
}

/** Below the charts: what the company is executing and what it runs on. */
export function OperationalKpiBands({ kpi, loading }: BandProps) {
  return (
    <>
      <OperationsBand kpi={kpi} loading={loading} />
      <ResourcesBand kpi={kpi} loading={loading} />
    </>
  )
}

function OperationsBand({ kpi, loading }: BandProps) {
  return (
    <ModuleSection title="Operaciones">
      <StatGrid>
        <StatCard
          label="Órdenes de trabajo abiertas"
          value={formatInteger(kpi?.ot_abiertas)}
          hint={`${formatInteger(kpi?.ot_en_ejecucion)} en ejecución`}
          tone="info"
          icon={<ClipboardList size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Órdenes críticas"
          value={formatInteger(kpi?.ot_criticas)}
          hint="Prioridad crítica sin cerrar"
          tone={toneForCount(kpi?.ot_criticas)}
          icon={<AlertTriangle size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Completadas en el mes"
          value={formatInteger(kpi?.ot_completadas_mes)}
          hint="Órdenes cerradas en el período"
          tone="positive"
          icon={<Wrench size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Incidentes de seguridad"
          value={formatInteger(kpi?.incidentes_seguridad_mes)}
          hint="Registrados en el mes"
          tone={toneForCount(kpi?.incidentes_seguridad_mes)}
          icon={<ShieldAlert size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
      </StatGrid>
    </ModuleSection>
  )
}

function ResourcesBand({ kpi, loading }: BandProps) {
  // Roadworthiness, not mechanical availability — the same definition the fleet
  // module publishes, so the cover page and the module never quote two
  // different fleet figures at a visitor who checks both.
  const fleetRatio = ratio(kpi?.flota_apta_circular, kpi?.flota_total)
  const equipmentRatio = ratio(kpi?.equipos_disponibles, kpi?.equipos_total)
  return (
    <ModuleSection title="Cartera y recursos">
      <StatGrid>
        <StatCard
          label="Proyectos activos"
          value={formatInteger(kpi?.proyectos_activos)}
          hint="En curso o planificados"
          tone="info"
          icon={<FolderKanban size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Clientes activos"
          value={formatInteger(kpi?.clientes_activos)}
          hint="Con operación vigente"
          tone="positive"
          icon={<Users size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Dotación activa"
          value={formatInteger(kpi?.dotacion_activa)}
          hint="Personal en actividad"
          tone="neutral"
          icon={<HardHat size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Facturas pendientes"
          value={formatInteger(kpi?.facturas_pendientes)}
          hint="Emitidas y sin cobrar"
          tone="warning"
          icon={<ReceiptText size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="En condiciones de circular"
          value={`${formatInteger(kpi?.flota_apta_circular)} / ${formatInteger(kpi?.flota_total)}`}
          hint={
            fleetRatio === null
              ? 'Operativos con VTV y seguro vigentes'
              : `${formatPercent(fleetRatio)} de la flota`
          }
          tone={fleetRatio !== null && fleetRatio < 80 ? 'warning' : 'positive'}
          icon={<Truck size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
        <StatCard
          label="Equipos disponibles"
          value={`${formatInteger(kpi?.equipos_disponibles)} / ${formatInteger(kpi?.equipos_total)}`}
          hint={
            equipmentRatio === null
              ? 'Equipos y herramientas'
              : `${formatPercent(equipmentRatio)} del parque`
          }
          tone={equipmentRatio !== null && equipmentRatio < 60 ? 'warning' : 'positive'}
          icon={<Boxes size={ICON_SIZE} strokeWidth={2} />}
          loading={loading}
        />
      </StatGrid>
    </ModuleSection>
  )
}

/** Counts of bad things: zero is good news, anything above zero is not. */
function toneForCount(value: number | null | undefined): Tone {
  if (value === null || value === undefined) return 'neutral'
  return value > 0 ? 'critical' : 'positive'
}
