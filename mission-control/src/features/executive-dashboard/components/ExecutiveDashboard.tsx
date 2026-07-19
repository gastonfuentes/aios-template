'use client'

/**
 * Executive dashboard — KPI tiles from `gd_kpi_ejecutivo`.
 *
 * Day 2 scope: the headline figures only. The charts (billing series, revenue by
 * service, client ranking) are day 3, which is why `gd_facturacion_mensual`,
 * `gd_ingresos_por_servicio` and `gd_ranking_clientes` are not read here yet.
 *
 * The view returns exactly one row. Tiles are grouped into three bands —
 * commercial, operations, resources — so the presenter can walk the board
 * top-to-bottom instead of scanning a flat grid of twenty numbers.
 */

import {
  AlertTriangle,
  Banknote,
  Boxes,
  ClipboardList,
  Clock,
  FolderKanban,
  HardHat,
  Percent,
  ReceiptText,
  ShieldAlert,
  Truck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { ModuleSection, ModuleShell } from '@/features/gannet/components/ModuleShell'
import { StatCard, StatGrid } from '@/features/gannet/components/StatCard'
import { useView } from '@/features/gannet/useView'
import {
  formatArsCompact,
  formatDateTime,
  formatInteger,
  formatPercent,
} from '@/features/gannet/format'
import type { KpiEjecutivo } from '@/features/gannet/types'
import type { Tone } from '@/features/gannet/tone'

const ICON_SIZE = 14

export function ExecutiveDashboard() {
  const { rows, loading, error, reload } = useView<KpiEjecutivo>('gd_kpi_ejecutivo')
  const kpi = rows[0]

  // Ratios are computed here rather than in the view: the view already exposes
  // both numerator and denominator, and deriving them in the client keeps the
  // migration untouched.
  const fleetRatio = ratio(kpi?.flota_operativa, kpi?.flota_total)
  const equipmentRatio = ratio(kpi?.equipos_disponibles, kpi?.equipos_total)
  const overdueShare = ratio(kpi?.cobranza_vencida_ars, kpi?.cobranza_pendiente_ars)

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
      {!loading && !error && !kpi ? (
        <p
          className="mc-card rounded-card px-4 py-12 text-center text-callout"
          style={{ color: 'var(--label-tertiary)' }}
        >
          Todavía no hay indicadores calculados.
        </p>
      ) : (
        <>
          <ModuleSection title="Comercial y cobranzas">
            <StatGrid>
              <StatCard
                label="Facturación del mes"
                value={formatArsCompact(kpi?.facturacion_mes_ars)}
                hint={`Acumulado del año: ${formatArsCompact(kpi?.facturacion_ytd_ars)}`}
                tone="positive"
                icon={<Banknote size={ICON_SIZE} strokeWidth={2} />}
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
                label="Cobranza vencida"
                value={formatArsCompact(kpi?.cobranza_vencida_ars)}
                hint={
                  overdueShare === null
                    ? 'Sobre el total pendiente'
                    : `${formatPercent(overdueShare)} del total pendiente`
                }
                tone="critical"
                icon={<AlertTriangle size={ICON_SIZE} strokeWidth={2} />}
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
                label="Flota operativa"
                value={`${formatInteger(kpi?.flota_operativa)} / ${formatInteger(kpi?.flota_total)}`}
                hint={fleetRatio === null ? 'Vehículos disponibles' : `${formatPercent(fleetRatio)} de la flota`}
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
              <StatCard
                label="Facturas pendientes"
                value={formatInteger(kpi?.facturas_pendientes)}
                hint="Emitidas y sin cobrar"
                tone="warning"
                icon={<ReceiptText size={ICON_SIZE} strokeWidth={2} />}
                loading={loading}
              />
              <StatCard
                label="Órdenes en ejecución"
                value={formatInteger(kpi?.ot_en_ejecucion)}
                hint="Trabajo en curso hoy"
                tone="accent"
                icon={<Clock size={ICON_SIZE} strokeWidth={2} />}
                loading={loading}
              />
              <StatCard
                label="Facturación acumulada"
                value={formatArsCompact(kpi?.facturacion_ytd_ars)}
                hint="Ejercicio en curso"
                tone="positive"
                icon={<Banknote size={ICON_SIZE} strokeWidth={2} />}
                loading={loading}
              />
            </StatGrid>
          </ModuleSection>
        </>
      )}
    </ModuleShell>
  )
}

/** Percentage of `part` over `total`, or null when the ratio is undefined. */
function ratio(part: number | null | undefined, total: number | null | undefined): number | null {
  if (part === null || part === undefined) return null
  if (total === null || total === undefined || total === 0) return null
  return (part / total) * 100
}

/** Counts of bad things: zero is good news, anything above zero is not. */
function toneForCount(value: number | null | undefined): Tone {
  if (value === null || value === undefined) return 'neutral'
  return value > 0 ? 'critical' : 'positive'
}
