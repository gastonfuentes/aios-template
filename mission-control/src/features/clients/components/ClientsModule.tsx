'use client'

/**
 * Clients module — grid over `gd_clientes` with a drill-down into
 * `gd_cliente_detalle`.
 *
 * The detail panel is fetched on demand (`enabled` gated on the selection)
 * rather than loading all thirty detail rows up front: the detail view is by far
 * the widest in the schema and only one row is ever displayed.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { DataTable, type Column } from '@/core/ui/table'
import { ModuleShell } from '@/features/gannet/components/ModuleShell'
import { Pill } from '@/features/gannet/components/Pill'
import { useView } from '@/features/gannet/useView'
import { CLIENT_STATE, describe } from '@/features/gannet/labels'
import {
  EMPTY,
  formatArs,
  formatArsCompact,
  formatDate,
  formatDateTime,
  formatInteger,
  formatPercent,
  humanize,
} from '@/features/gannet/format'
import type { Cliente, ClienteDetalle } from '@/features/gannet/types'

const COLUMNS: readonly Column<Cliente>[] = [
  {
    key: 'cliente',
    header: 'Cliente',
    render: (row) => (
      <div className="min-w-0">
        <div className="truncate" style={{ color: 'var(--label-primary)' }}>
          {row.cliente}
        </div>
        <div className="truncate text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {row.cuit ?? EMPTY}
        </div>
      </div>
    ),
    sortValue: (row) => row.cliente,
    searchValue: (row) => `${row.cliente} ${row.razon_social ?? ''} ${row.cuit ?? ''}`,
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (row) => {
      const state = describe(CLIENT_STATE, row.estado)
      return <Pill tone={state.tone}>{state.label}</Pill>
    },
    sortValue: (row) => row.estado,
    searchValue: (row) => row.estado ?? '',
  },
  {
    key: 'mineral_principal',
    header: 'Mineral',
    hideBelow: 'lg',
    render: (row) => humanize(row.mineral_principal),
    sortValue: (row) => row.mineral_principal,
    searchValue: (row) => row.mineral_principal ?? '',
  },
  {
    key: 'provincia',
    header: 'Provincia',
    hideBelow: 'md',
    render: (row) => row.provincia ?? EMPTY,
    sortValue: (row) => row.provincia,
    searchValue: (row) => `${row.provincia ?? ''} ${row.localidad ?? ''}`,
  },
  {
    key: 'ejecutivo_cuenta',
    header: 'Ejecutivo de cuenta',
    hideBelow: 'xl',
    render: (row) => row.ejecutivo_cuenta ?? EMPTY,
    sortValue: (row) => row.ejecutivo_cuenta,
    searchValue: (row) => row.ejecutivo_cuenta ?? '',
  },
  {
    key: 'proyectos_activos',
    header: 'Proyectos',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => formatInteger(row.proyectos_activos),
    sortValue: (row) => row.proyectos_activos,
  },
  {
    key: 'ot_abiertas',
    header: 'OT abiertas',
    align: 'right',
    hideBelow: 'sm',
    render: (row) => formatInteger(row.ot_abiertas),
    sortValue: (row) => row.ot_abiertas,
  },
  {
    key: 'facturado_ars',
    header: 'Facturado',
    align: 'right',
    render: (row) => (
      <span className="tabular-nums">{formatArsCompact(row.facturado_ars)}</span>
    ),
    sortValue: (row) => row.facturado_ars,
  },
  {
    key: 'saldo_pendiente_ars',
    header: 'Saldo pendiente',
    align: 'right',
    render: (row) => (
      <span
        className="tabular-nums"
        style={{
          color:
            (row.saldo_pendiente_ars ?? 0) > 0 ? 'var(--sys-orange)' : 'var(--label-secondary)',
        }}
      >
        {formatArsCompact(row.saldo_pendiente_ars)}
      </span>
    ),
    sortValue: (row) => row.saldo_pendiente_ars,
  },
]

export function ClientsModule() {
  const { rows, loading, error, reload } = useView<Cliente>('gd_clientes')
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <ModuleShell
      title="Clientes"
      description="Cartera de compañías mineras, su operación vigente y su situación de cobranza. Seleccione una fila para ver el detalle."
      loading={loading}
      error={error}
      onReload={reload}
    >
      <DataTable
        rows={rows}
        columns={COLUMNS}
        getRowId={(row) => String(row.cliente_id)}
        loading={loading}
        initialSort={{ key: 'facturado_ars', direction: 'desc' }}
        searchPlaceholder="Buscar por cliente, CUIT o provincia…"
        emptyMessage="Todavía no hay clientes cargados."
        onRowClick={(row) => setSelected(row.cliente_id)}
        rowAccent={(row) => (row.estado === 'moroso' ? 'var(--sys-red)' : null)}
      />

      <ClientDetailPanel clientId={selected} onClose={() => setSelected(null)} />
    </ModuleShell>
  )
}

/** Slide-over detail for a single client, read from `gd_cliente_detalle`. */
function ClientDetailPanel({
  clientId,
  onClose,
}: {
  clientId: number | null
  onClose: () => void
}) {
  const { rows, loading, error } = useView<ClienteDetalle>('gd_cliente_detalle', {
    params: { cliente_id: clientId ?? undefined },
    enabled: clientId !== null,
  })

  if (clientId === null) return null
  const detail = rows[0]

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar detalle"
        onClick={onClose}
        className="absolute inset-0"
        style={{ background: 'rgb(0 0 0 / 0.35)' }}
      />
      {/* `mc-card` already paints an opaque surface in both themes. Do not add a
          background of its own: a translucent fill lets the page show through. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del cliente"
        className="mc-card relative flex h-full w-full max-w-lg flex-col overflow-auto"
      >
        <header
          className="sticky top-0 flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--separator)', background: 'inherit' }}
        >
          <div className="min-w-0">
            <h2 className="truncate text-headline" style={{ color: 'var(--label-primary)' }}>
              {detail?.cliente ?? 'Cargando…'}
            </h2>
            <p className="truncate text-caption1" style={{ color: 'var(--label-tertiary)' }}>
              {detail?.razon_social ?? ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="mc-interactive inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-control"
            style={{ background: 'var(--fill-secondary)', color: 'var(--label-primary)' }}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <div className="flex flex-col gap-5 px-5 py-4">
          {error ? (
            <p className="text-callout" style={{ color: 'var(--sys-red)' }}>
              {error}
            </p>
          ) : loading && !detail ? (
            <p className="text-callout" style={{ color: 'var(--label-tertiary)' }}>
              Cargando detalle…
            </p>
          ) : !detail ? (
            <p className="text-callout" style={{ color: 'var(--label-tertiary)' }}>
              No se encontró el detalle de este cliente.
            </p>
          ) : (
            <>
              <DetailGroup title="Ficha">
                <DetailRow label="CUIT" value={detail.cuit ?? EMPTY} />
                <DetailRow label="Mineral principal" value={humanize(detail.mineral_principal)} />
                <DetailRow
                  label="Ubicación"
                  value={[detail.localidad, detail.provincia].filter(Boolean).join(', ') || EMPTY}
                />
                <DetailRow label="Alta" value={formatDate(detail.fecha_alta)} />
                <DetailRow
                  label="Condición de pago"
                  value={
                    detail.condicion_pago_dias === null
                      ? EMPTY
                      : `${detail.condicion_pago_dias} días`
                  }
                />
                <DetailRow
                  label="Límite de crédito"
                  value={formatArs(detail.limite_credito_ars)}
                />
                <DetailRow label="Ejecutivo de cuenta" value={detail.ejecutivo_cuenta ?? EMPTY} />
              </DetailGroup>

              <DetailGroup title="Contacto principal">
                <DetailRow label="Nombre" value={detail.contacto_principal ?? EMPTY} />
                <DetailRow label="Cargo" value={detail.contacto_principal_cargo ?? EMPTY} />
                <DetailRow label="Correo" value={detail.contacto_principal_email ?? EMPTY} />
                <DetailRow label="Teléfono" value={detail.contacto_principal_telefono ?? EMPTY} />
                <DetailRow
                  label="Contactos activos"
                  value={formatInteger(detail.contactos_activos)}
                />
              </DetailGroup>

              <DetailGroup title="Operación">
                <DetailRow label="Faenas activas" value={formatInteger(detail.faenas_activas)} />
                <DetailRow label="Faenas" value={detail.faenas ?? EMPTY} />
                <DetailRow
                  label="Proyectos"
                  value={`${formatInteger(detail.proyectos_activos)} activos de ${formatInteger(detail.proyectos_total)}`}
                />
                <DetailRow
                  label="Órdenes de trabajo"
                  value={`${formatInteger(detail.ot_abiertas)} abiertas de ${formatInteger(detail.ot_total)}`}
                />
                <DetailRow
                  label="Órdenes críticas"
                  value={formatInteger(detail.ot_criticas)}
                  tone={(detail.ot_criticas ?? 0) > 0 ? 'var(--sys-red)' : undefined}
                />
                <DetailRow
                  label="Incidentes de seguridad"
                  value={formatInteger(detail.incidentes_seguridad)}
                  tone={(detail.incidentes_seguridad ?? 0) > 0 ? 'var(--sys-orange)' : undefined}
                />
              </DetailGroup>

              <DetailGroup title="Comercial">
                <DetailRow
                  label="Cotizaciones"
                  value={`${formatInteger(detail.cotizaciones_abiertas)} abiertas de ${formatInteger(detail.cotizaciones_total)}`}
                />
                <DetailRow label="Pipeline abierto" value={formatArs(detail.pipeline_abierto_ars)} />
                <DetailRow
                  label="Tasa de conversión"
                  value={formatPercent(detail.tasa_conversion_pct)}
                />
                <DetailRow label="Contratado" value={formatArs(detail.contratado_ars)} />
                <DetailRow label="Ejecutado" value={formatArs(detail.ejecutado_ars)} />
              </DetailGroup>

              <DetailGroup title="Facturación y cobranza">
                <DetailRow label="Facturado total" value={formatArs(detail.facturado_total_ars)} />
                <DetailRow label="Facturado en el año" value={formatArs(detail.facturado_ytd_ars)} />
                <DetailRow
                  label="Saldo pendiente"
                  value={formatArs(detail.saldo_pendiente_ars)}
                  tone={(detail.saldo_pendiente_ars ?? 0) > 0 ? 'var(--sys-orange)' : undefined}
                />
                <DetailRow
                  label="Saldo vencido"
                  value={formatArs(detail.saldo_vencido_ars)}
                  tone={(detail.saldo_vencido_ars ?? 0) > 0 ? 'var(--sys-red)' : undefined}
                />
                <DetailRow label="Última factura" value={formatDate(detail.ultima_factura_el)} />
              </DetailGroup>

              <DetailGroup title="Actividad">
                <DetailRow label="Última actividad" value={detail.ultima_actividad ?? EMPTY} />
                <DetailRow
                  label="Registrada"
                  value={formatDateTime(detail.ultima_actividad_en)}
                />
                <DetailRow
                  label="Documentos asociados"
                  value={formatInteger(detail.documentos_total)}
                />
              </DetailGroup>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-caption1 uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
        {title}
      </h3>
      <dl className="flex flex-col">{children}</dl>
    </section>
  )
}

function DetailRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0"
      style={{ borderColor: 'var(--separator)' }}
    >
      <dt className="shrink-0 text-caption1" style={{ color: 'var(--label-secondary)' }}>
        {label}
      </dt>
      <dd
        className="min-w-0 text-right text-callout tabular-nums"
        style={{ color: tone ?? 'var(--label-primary)' }}
      >
        {value}
      </dd>
    </div>
  )
}
