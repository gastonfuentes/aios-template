/**
 * Tipos y configuración de presentación del dashboard de proveedores (demo).
 *
 * Política de números — regla dura de la demo: solo se muestra plata donde la
 * base de datos tiene facturación real.
 *
 *   - gas / transporte → `monto_ars` / `costo_ars` por operación. Es facturación
 *     real: se rotula "Facturado".
 *   - personal → `turnos_personal` NO tiene ninguna columna de monto. No se
 *     inventa ninguna tarifa: la métrica de plata muestra "No aplica" y en su
 *     lugar se destacan las horas totales. Nunca se muestra "$ 0".
 *   - obras → `presupuesto_ars` es presupuesto, no facturación, y viene cargado
 *     por fila de avance. Se rotula "Presupuesto en cartera" y se agrega como el
 *     presupuesto del último avance de cada obra (sumar todas las filas contaría
 *     la misma obra varias veces). Nunca se rotula "facturado" ni "total".
 */

/** Rubro canónico de la demo — orden y presentación fijos. */
export type Rubro = 'gas' | 'transporte' | 'personal' | 'obras'

/** Cómo se trata la métrica monetaria de cada rubro. */
export type PoliticaMonto = 'facturado' | 'presupuesto' | 'no-aplica'

export type ResumenRow = {
  rubro: Rubro
  registros: number
  /** null cuando el rubro no tiene importes reales en la base (personal). */
  total_ars: number | null
}

export type ActividadRow = {
  proveedor_id: number
  proveedor: string
  rubro: Rubro
  fecha: string
  detalle: string
  cantidad: number
  unidad: string
  monto: number | null
  estado: string
}

export type ProveedorDetalle = {
  proveedor_id: number
  proveedor: string
  rubro: Rubro
  cuit: string
  contacto: string | null
  email: string | null
  activo: boolean
  actividades_total: number
  actividades_mes: number
  actividades_mes_anterior: number
  monto_total_ars: number | null
  monto_mes_ars: number | null
  ultima_actividad: string | null
  dias_sin_actividad: number | null
  actividades_ok: number
  actividades_en_curso: number
  actividades_alerta: number
  estado_operativo: EstadoOperativo
  cantidad_total: number | null
  cantidad_unidad: string | null
  obras_en_cartera: number | null
  avance_promedio: number | null
}

export type EstadoOperativo = 'operativo' | 'en_riesgo' | 'sin_actividad' | 'inactivo'

export type ApiResponse = {
  resumen: ResumenRow[]
  actividad: ActividadRow[]
  error?: string
}

export type DetalleResponse = {
  detalle: ProveedorDetalle | null
  actividad: ActividadRow[]
  error?: string
}

export const RUBRO_CONFIG: Record<
  Rubro,
  {
    label: string
    emoji: string
    unitLabel: string
    color: string
    /** Etiqueta de la métrica monetaria, o null cuando el rubro no tiene plata. */
    moneyLabel: string | null
    politicaMonto: PoliticaMonto
  }
> = {
  gas: {
    label: 'Gas',
    emoji: '⛽',
    unitLabel: 'entregas',
    color: 'var(--sys-yellow)',
    moneyLabel: 'Facturado',
    politicaMonto: 'facturado',
  },
  transporte: {
    label: 'Transporte',
    emoji: '🚚',
    unitLabel: 'viajes',
    color: 'var(--sys-blue)',
    moneyLabel: 'Facturado',
    politicaMonto: 'facturado',
  },
  personal: {
    label: 'Personal',
    emoji: '👷',
    unitLabel: 'turnos',
    color: 'var(--sys-green)',
    moneyLabel: null,
    politicaMonto: 'no-aplica',
  },
  obras: {
    label: 'Obras',
    emoji: '🏗',
    unitLabel: 'avances',
    color: 'var(--sys-orange)',
    moneyLabel: 'Presupuesto en cartera',
    politicaMonto: 'presupuesto',
  },
}

export const RUBRO_ORDER: readonly Rubro[] = ['gas', 'transporte', 'personal', 'obras']

/** Ventana real de datos cargados en la demo. No hay serie histórica más larga. */
export const RANGO_DATOS = '19 jun 2026 – 18 jul 2026'

export const ESTADO_OPERATIVO_CONFIG: Record<
  EstadoOperativo,
  { label: string; color: string }
> = {
  operativo: { label: 'Operativo', color: 'var(--sys-green)' },
  en_riesgo: { label: 'Sin movimientos hace más de 7 días', color: 'var(--sys-orange)' },
  sin_actividad: { label: 'Sin actividad registrada', color: 'var(--label-tertiary)' },
  inactivo: { label: 'Inactivo', color: 'var(--sys-red)' },
}

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatArs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return arsFormatter.format(value)
}

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })

export function formatCantidad(value: number | null | undefined, unidad?: string | null): string {
  if (value === null || value === undefined) return '—'
  const n = numberFormatter.format(value)
  return unidad ? `${n} ${unidad}` : n
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' })

export function formatFecha(value: string | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return dateFormatter.format(d)
}

/**
 * Valor a mostrar en el slot monetario de una fila de actividad.
 * Solo gas y transporte tienen facturación real por operación; el resto muestra
 * la cantidad en su unidad para no simular un importe.
 */
export function montoDeFila(row: ActividadRow): string {
  const cfg = RUBRO_CONFIG[row.rubro]
  if (cfg?.politicaMonto === 'facturado') return formatArs(row.monto)
  return formatCantidad(row.cantidad, row.unidad)
}
