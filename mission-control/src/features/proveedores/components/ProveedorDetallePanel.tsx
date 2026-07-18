'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Modal } from '@/core/components/macos/Modal'
import {
  ESTADO_OPERATIVO_CONFIG,
  RANGO_DATOS,
  RUBRO_CONFIG,
  formatArs,
  formatCantidad,
  formatFecha,
  montoDeFila,
  type ActividadRow,
  type DetalleResponse,
  type ProveedorDetalle,
} from '../types'

/**
 * Panel lateral con la ficha de un proveedor.
 *
 * Reusa el Modal canónico con placement="sheet-right" (portal, Escape,
 * click-afuera, animación y redondeo ya resueltos ahí).
 *
 * La métrica monetaria respeta la política declarada en `types.ts`: personal no
 * tiene ninguna columna de plata en la base, así que muestra "No aplica" y
 * destaca las horas; obras suma el presupuesto contratado de cada obra en
 * cartera (constante a lo largo de sus avances), nunca facturación.
 */
export function ProveedorDetallePanel({
  proveedorId,
  onClose,
}: {
  proveedorId: number | null
  onClose: () => void
}) {
  // El resultado se guarda junto al id que lo produjo. Así el estado de carga se
  // deriva por comparación en vez de resetearse con setState síncrono dentro del
  // effect (regla react-hooks/set-state-in-effect), y nunca se muestran los datos
  // de un proveedor anterior mientras carga el siguiente.
  const [datos, setDatos] = useState<
    { id: number; detalle: ProveedorDetalle; actividad: ActividadRow[] } | null
  >(null)
  const [fallo, setFallo] = useState<{ id: number; mensaje: string } | null>(null)

  useEffect(() => {
    if (proveedorId === null) return
    let cancelled = false

    void (async () => {
      try {
        const res = await fetch(`/api/proveedores/${proveedorId}`, { cache: 'no-store' })
        const json = (await res.json()) as DetalleResponse
        if (cancelled) return
        if (!res.ok || json.error || !json.detalle) {
          setFallo({ id: proveedorId, mensaje: json.error ?? 'No se pudo cargar el proveedor.' })
          return
        }
        setDatos({ id: proveedorId, detalle: json.detalle, actividad: json.actividad })
      } catch {
        if (!cancelled) {
          setFallo({ id: proveedorId, mensaje: 'No se pudo cargar el proveedor.' })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [proveedorId])

  const vigente = proveedorId !== null && datos?.id === proveedorId ? datos : null
  const detalle = vigente?.detalle ?? null
  const actividad = vigente?.actividad ?? []
  const error = proveedorId !== null && fallo?.id === proveedorId ? fallo.mensaje : null
  const loading = proveedorId !== null && !vigente && !error

  const cfg = detalle ? RUBRO_CONFIG[detalle.rubro] : null

  return (
    <Modal
      open={proveedorId !== null}
      onClose={onClose}
      label="Detalle del proveedor"
      placement="sheet-right"
      panelMaxWidth="480px"
      panelClassName="flex flex-col"
    >
      <header
        className="flex items-start gap-3 border-b p-4"
        style={{ borderColor: 'var(--separator)' }}
      >
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-headline" style={{ color: 'var(--label-primary)' }}>
            {detalle?.proveedor ?? (loading ? 'Cargando…' : 'Proveedor')}
          </h2>
          {cfg && detalle && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-caption2"
              style={{
                background: `color-mix(in oklab, ${cfg.color} 14%, transparent)`,
                color: cfg.color,
              }}
            >
              <span aria-hidden>{cfg.emoji}</span>
              {cfg.label}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle"
          className="mc-interactive shrink-0 rounded-control p-1.5"
          style={{ background: 'var(--fill-secondary)', color: 'var(--label-secondary)' }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {error && (
          <p className="text-callout" style={{ color: 'var(--sys-orange)' }}>
            {error}
          </p>
        )}

        {!error && loading && !detalle && (
          <p className="text-callout" style={{ color: 'var(--label-tertiary)' }}>
            Cargando detalle…
          </p>
        )}

        {detalle && (
          <div className="flex flex-col gap-4">
            <FichaProveedor detalle={detalle} />
            <MetricasProveedor detalle={detalle} />
            <ActividadProveedor actividad={actividad} />
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Datos de contacto y estado operativo. */
function FichaProveedor({ detalle }: { detalle: ProveedorDetalle }) {
  const estado = ESTADO_OPERATIVO_CONFIG[detalle.estado_operativo]
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: estado.color }}
        />
        <span className="text-callout" style={{ color: estado.color }}>
          {estado.label}
        </span>
      </div>
      <dl className="flex flex-col gap-1">
        <DatoFicha label="CUIT" value={detalle.cuit} />
        <DatoFicha label="Contacto" value={detalle.contacto ?? '—'} />
        <DatoFicha label="Email" value={detalle.email ?? '—'} />
        <DatoFicha label="Última actividad" value={formatFecha(detalle.ultima_actividad)} />
      </dl>
    </section>
  )
}

function DatoFicha({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-footnote" style={{ color: 'var(--label-tertiary)' }}>
        {label}
      </dt>
      <dd className="min-w-0 truncate text-callout" style={{ color: 'var(--label-primary)' }}>
        {value}
      </dd>
    </div>
  )
}

/** Métricas agregadas — la de plata sale de la política del rubro. */
function MetricasProveedor({ detalle }: { detalle: ProveedorDetalle }) {
  const cfg = RUBRO_CONFIG[detalle.rubro]
  return (
    <section className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Metrica
          label="Actividades del mes"
          value={detalle.actividades_mes.toLocaleString('es-AR')}
        />
        <MetricaMonto detalle={detalle} />
      </div>

      {cfg.politicaMonto === 'presupuesto' && (
        <p className="text-caption1" style={{ color: 'var(--label-tertiary)' }}>
          Presupuesto contratado por obra, constante a lo largo de sus avances
          {detalle.obras_en_cartera ? ` (${detalle.obras_en_cartera} obras` : ''}
          {detalle.avance_promedio !== null
            ? `, ${detalle.avance_promedio}% de avance promedio)`
            : detalle.obras_en_cartera
              ? ')'
              : ''}
          . Es presupuesto, no facturación.
        </p>
      )}
      {cfg.politicaMonto === 'no-aplica' && (
        <p className="text-caption1" style={{ color: 'var(--label-tertiary)' }}>
          Los turnos de personal no registran importes en el sistema. Se informan horas.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Metrica
          label="Al día"
          value={detalle.actividades_ok.toLocaleString('es-AR')}
          color="var(--sys-green)"
        />
        <Metrica
          label="En curso"
          value={detalle.actividades_en_curso.toLocaleString('es-AR')}
          color="var(--sys-blue)"
        />
        <Metrica
          label="Con alerta"
          value={detalle.actividades_alerta.toLocaleString('es-AR')}
          color={detalle.actividades_alerta > 0 ? 'var(--sys-orange)' : undefined}
        />
      </div>

      <p className="text-caption1" style={{ color: 'var(--label-tertiary)' }}>
        Datos cargados: {RANGO_DATOS}.
      </p>
    </section>
  )
}

/** Slot monetario — "No aplica" cuando el rubro no tiene plata en la base. */
function MetricaMonto({ detalle }: { detalle: ProveedorDetalle }) {
  const cfg = RUBRO_CONFIG[detalle.rubro]
  if (cfg.politicaMonto === 'no-aplica') {
    return (
      <Metrica
        label="Facturación"
        value="No aplica"
        hint={`${formatCantidad(detalle.cantidad_total, detalle.cantidad_unidad)} registradas`}
      />
    )
  }
  return (
    <Metrica
      label={cfg.moneyLabel ?? 'Monto'}
      value={formatArs(detalle.monto_total_ars)}
      hint={
        detalle.cantidad_total !== null
          ? formatCantidad(detalle.cantidad_total, detalle.cantidad_unidad)
          : undefined
      }
    />
  )
}

function Metrica({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: string
  hint?: string
  color?: string
}) {
  return (
    <div className="rounded-card p-2.5" style={{ background: 'var(--fill-secondary)' }}>
      <div className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
        {label}
      </div>
      <div
        className="mt-0.5 truncate text-body tabular-nums"
        style={{ color: color ?? 'var(--label-primary)' }}
      >
        {value}
      </div>
      {hint && (
        <div className="truncate text-caption1" style={{ color: 'var(--label-tertiary)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

/** Actividad reciente del proveedor. */
function ActividadProveedor({ actividad }: { actividad: ActividadRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-callout" style={{ color: 'var(--label-secondary)' }}>
        Actividad reciente
      </h3>
      {actividad.length === 0 ? (
        <p className="text-footnote" style={{ color: 'var(--label-tertiary)' }}>
          Sin actividad registrada.
        </p>
      ) : (
        <ul className="flex flex-col">
          {actividad.map((row, i) => (
            <li
              key={`${row.fecha}-${row.detalle}-${i}`}
              className="flex items-center gap-2 py-2"
              style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--separator)' }}
            >
              <span
                className="w-12 shrink-0 text-caption1"
                style={{ color: 'var(--label-tertiary)' }}
              >
                {formatFecha(row.fecha)}
              </span>
              <span className="min-w-0 flex-1 truncate text-footnote" style={{ color: 'var(--label-primary)' }}>
                {row.detalle}
              </span>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-caption2"
                style={{ background: 'var(--fill-secondary)', color: 'var(--label-secondary)' }}
              >
                {row.estado}
              </span>
              <span
                className="w-24 shrink-0 text-right text-caption1 tabular-nums"
                style={{ color: 'var(--label-secondary)' }}
              >
                {montoDeFila(row)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
