'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { ProveedorDetallePanel } from './ProveedorDetallePanel'
import {
  RANGO_DATOS,
  RUBRO_CONFIG,
  RUBRO_ORDER,
  formatArs,
  formatFecha,
  montoDeFila,
  type ActividadRow,
  type ApiResponse,
  type ResumenRow,
  type Rubro,
} from '../types'

export function ProveedoresDashboard() {
  const [resumen, setResumen] = useState<ResumenRow[]>([])
  const [actividad, setActividad] = useState<ActividadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Rubro del drill-down activo, o null cuando no hay filtro. */
  const [rubroActivo, setRubroActivo] = useState<Rubro | null>(null)
  /** Proveedor cuyo panel de detalle está abierto. */
  const [proveedorAbierto, setProveedorAbierto] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/proveedores', { cache: 'no-store' })
      const json = (await res.json()) as ApiResponse
      if (!res.ok || json.error) {
        setError(json.error ?? 'No se pudo cargar la información.')
        return
      }
      setResumen(json.resumen)
      setActividad(json.actividad)
      setError(null)
    } catch {
      setError('No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial + polling cada 10s. El botón "Actualizar" fuerza un refresh
  // inmediato (la demo arrastra un Excel a Drive y muestra la fila nueva).
  // La primera carga se difiere con un timeout de 0ms para no disparar setState
  // de forma síncrona dentro del effect (regla react-hooks/set-state-in-effect).
  useEffect(() => {
    const inicial = setTimeout(() => void load(), 0)
    const interval = setInterval(() => void load(), 10_000)
    return () => {
      clearTimeout(inicial)
      clearInterval(interval)
    }
  }, [load])

  // Mapa rubro → resumen para lookup en orden fijo.
  const byRubro = useMemo(() => new Map(resumen.map((r) => [r.rubro, r])), [resumen])

  // El filtro de drill-down se aplica en cliente sobre la actividad ya cargada:
  // así el polling de 10s no se reinicia al cambiar de rubro.
  const actividadVisible = useMemo(
    () => (rubroActivo ? actividad.filter((row) => row.rubro === rubroActivo) : actividad),
    [actividad, rubroActivo],
  )

  const toggleRubro = useCallback((rubro: Rubro) => {
    setRubroActivo((actual) => (actual === rubro ? null : rubro))
  }, [])

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-5 overflow-auto px-6 py-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-title2" style={{ color: 'var(--label-primary)' }}>
            Proveedores
          </h1>
          <p className="text-footnote" style={{ color: 'var(--label-tertiary)' }}>
            Resumen operativo por rubro y actividad reciente. Datos cargados: {RANGO_DATOS}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="mc-interactive inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-callout"
          style={{ background: 'var(--fill-secondary)', color: 'var(--label-primary)' }}
        >
          <RefreshCw size={14} strokeWidth={2} className={loading ? 'animate-spin' : undefined} />
          Actualizar
        </button>
      </header>

      {error && (
        <p className="text-callout" style={{ color: 'var(--sys-orange)' }}>
          {error}
        </p>
      )}

      {/* Métricas por rubro — clickeables, filtran la actividad. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {RUBRO_ORDER.map((rubro) => (
          <RubroCard
            key={rubro}
            rubro={rubro}
            row={byRubro.get(rubro)}
            loading={loading}
            activo={rubroActivo === rubro}
            onToggle={toggleRubro}
          />
        ))}
      </section>

      <ActividadSection
        actividad={actividadVisible}
        loading={loading}
        rubroActivo={rubroActivo}
        onQuitarFiltro={() => setRubroActivo(null)}
        onAbrirProveedor={setProveedorAbierto}
      />

      <ProveedorDetallePanel
        proveedorId={proveedorAbierto}
        onClose={() => setProveedorAbierto(null)}
      />
    </div>
  )
}

/** Card de rubro — actúa como toggle del drill-down. */
function RubroCard({
  rubro,
  row,
  loading,
  activo,
  onToggle,
}: {
  rubro: Rubro
  row: ResumenRow | undefined
  loading: boolean
  activo: boolean
  onToggle: (rubro: Rubro) => void
}) {
  const cfg = RUBRO_CONFIG[rubro]
  const isLoadingEmpty = loading && !row
  return (
    <button
      type="button"
      onClick={() => onToggle(rubro)}
      aria-pressed={activo}
      aria-label={`Filtrar actividad por ${cfg.label}`}
      className="mc-card mc-interactive flex flex-col gap-2 rounded-card p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        borderTop: `2px solid ${cfg.color}`,
        outlineColor: cfg.color,
        background: activo ? `color-mix(in oklab, ${cfg.color} 12%, transparent)` : undefined,
      }}
    >
      <header className="flex items-center gap-2">
        <span aria-hidden className="text-headline leading-none">
          {cfg.emoji}
        </span>
        <span className="text-caption2" style={{ color: 'var(--label-secondary)' }}>
          {cfg.label}
        </span>
      </header>
      <div
        className="text-title1 tabular-nums"
        style={{ color: isLoadingEmpty ? 'var(--label-tertiary)' : cfg.color }}
      >
        {isLoadingEmpty ? '—' : (row?.registros ?? 0).toLocaleString('es-AR')}
      </div>
      <div className="text-footnote" style={{ color: 'var(--label-tertiary)' }}>
        {cfg.unitLabel}
      </div>
      {cfg.moneyLabel !== null && (
        <div>
          <div className="text-callout tabular-nums" style={{ color: 'var(--label-secondary)' }}>
            {isLoadingEmpty ? '—' : formatArs(row?.total_ars ?? null)}
          </div>
          <div className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
            {cfg.moneyLabel}
          </div>
        </div>
      )}
    </button>
  )
}

/** Lista de actividad reciente con encabezado de filtro activo. */
function ActividadSection({
  actividad,
  loading,
  rubroActivo,
  onQuitarFiltro,
  onAbrirProveedor,
}: {
  actividad: ActividadRow[]
  loading: boolean
  rubroActivo: Rubro | null
  onQuitarFiltro: () => void
  onAbrirProveedor: (id: number) => void
}) {
  const cfgActivo = rubroActivo ? RUBRO_CONFIG[rubroActivo] : null
  return (
    <section className="mc-card flex flex-col rounded-card">
      <header
        className="flex items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--separator)' }}
      >
        <h2 className="text-headline" style={{ color: 'var(--label-primary)' }}>
          Actividad reciente
        </h2>
        {cfgActivo && (
          <button
            type="button"
            onClick={onQuitarFiltro}
            className="mc-interactive inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-caption1"
            style={{
              background: `color-mix(in oklab, ${cfgActivo.color} 14%, transparent)`,
              color: cfgActivo.color,
            }}
          >
            <span aria-hidden>{cfgActivo.emoji}</span>
            {cfgActivo.label}
            <X size={12} strokeWidth={2} aria-hidden />
            <span className="sr-only">Quitar filtro por {cfgActivo.label}</span>
          </button>
        )}
      </header>

      {actividad.length === 0 ? (
        <p className="px-4 py-12 text-center text-callout" style={{ color: 'var(--label-tertiary)' }}>
          {loading
            ? 'Cargando actividad…'
            : cfgActivo
              ? `Sin actividad reciente de ${cfgActivo.label}.`
              : 'Sin actividad reciente todavía.'}
        </p>
      ) : (
        <ul className="flex flex-col">
          {actividad.map((row, i) => (
            <li
              key={`${row.fecha}-${row.proveedor_id}-${row.detalle}-${i}`}
              style={{ borderTop: i === 0 ? undefined : '0.5px solid var(--separator)' }}
            >
              <ActividadItem row={row} onAbrirProveedor={onAbrirProveedor} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Fila de actividad — abre el panel de detalle del proveedor. */
function ActividadItem({
  row,
  onAbrirProveedor,
}: {
  row: ActividadRow
  onAbrirProveedor: (id: number) => void
}) {
  const cfg = RUBRO_CONFIG[row.rubro]
  return (
    <button
      type="button"
      onClick={() => onAbrirProveedor(row.proveedor_id)}
      aria-label={`Ver detalle de ${row.proveedor}`}
      className="mc-interactive flex w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2"
      style={{ outlineColor: cfg?.color ?? 'var(--label-secondary)' }}
    >
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-caption2"
        style={{
          background: `color-mix(in oklab, ${cfg?.color ?? 'var(--label-secondary)'} 14%, transparent)`,
          color: cfg?.color ?? 'var(--label-secondary)',
        }}
      >
        <span aria-hidden>{cfg?.emoji}</span>
        {cfg?.label ?? row.rubro}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-body" style={{ color: 'var(--label-primary)' }}>
          {row.proveedor}
        </div>
        <div className="truncate text-footnote" style={{ color: 'var(--label-tertiary)' }}>
          {row.detalle}
        </div>
      </div>

      <span className="hidden shrink-0 text-caption1 sm:inline" style={{ color: 'var(--label-tertiary)' }}>
        {formatFecha(row.fecha)}
      </span>

      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-caption2"
        style={{ background: 'var(--fill-secondary)', color: 'var(--label-secondary)' }}
      >
        {row.estado}
      </span>

      <span
        className="w-24 shrink-0 text-right text-callout tabular-nums"
        style={{ color: 'var(--label-primary)' }}
      >
        {montoDeFila(row)}
      </span>
    </button>
  )
}
