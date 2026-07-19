/**
 * Display labels and tones for the enumerated values stored in the demo views.
 *
 * The database stores states as unaccented snake_case (`en_negociacion`,
 * `seguridad_higiene`). Accents cannot be recovered mechanically, so every
 * closed set is mapped explicitly here — this is the only place a Spanish label
 * is written for a database state, and the only place that decides whether a
 * state is neutral, healthy or alarming.
 *
 * `describe` falls back to a humanized version of the raw value for anything not
 * mapped, so an unexpected state renders readably instead of blanking the cell.
 */

import { humanize } from './format'
import type { Tone } from './tone'

export type LabelSpec = { readonly label: string; readonly tone: Tone }

type LabelMap = Readonly<Record<string, LabelSpec>>

/** Resolves a raw database value against a map, with a readable fallback. */
export function describe(map: LabelMap, value: string | null | undefined): LabelSpec {
  if (!value) return { label: '—', tone: 'neutral' }
  return map[value] ?? { label: humanize(value), tone: 'neutral' }
}

// --- Clients ---------------------------------------------------------------

export const CLIENT_STATE: LabelMap = {
  activo: { label: 'Activo', tone: 'positive' },
  prospecto: { label: 'Prospecto', tone: 'info' },
  moroso: { label: 'Moroso', tone: 'critical' },
  inactivo: { label: 'Inactivo', tone: 'neutral' },
}

// --- Quotes ----------------------------------------------------------------

export const QUOTE_STATE: LabelMap = {
  borrador: { label: 'Borrador', tone: 'neutral' },
  enviada: { label: 'Enviada', tone: 'info' },
  en_negociacion: { label: 'En negociación', tone: 'accent' },
  aceptada: { label: 'Aceptada', tone: 'positive' },
  rechazada: { label: 'Rechazada', tone: 'critical' },
  vencida: { label: 'Vencida', tone: 'warning' },
}

// --- Projects --------------------------------------------------------------

export const PROJECT_STATE: LabelMap = {
  planificado: { label: 'Planificado', tone: 'info' },
  en_curso: { label: 'En curso', tone: 'positive' },
  suspendido: { label: 'Suspendido', tone: 'warning' },
  finalizado: { label: 'Finalizado', tone: 'neutral' },
  cancelado: { label: 'Cancelado', tone: 'critical' },
}

export const CONTRACT_TYPE: LabelMap = {
  por_obra: { label: 'Por obra', tone: 'neutral' },
  por_servicio: { label: 'Por servicio', tone: 'neutral' },
  oc_abierta: { label: 'OC abierta', tone: 'neutral' },
}

// --- Work orders -----------------------------------------------------------

export const WORK_ORDER_STATE: LabelMap = {
  borrador: { label: 'Borrador', tone: 'neutral' },
  programada: { label: 'Programada', tone: 'info' },
  en_ejecucion: { label: 'En ejecución', tone: 'accent' },
  pausada: { label: 'Pausada', tone: 'warning' },
  completada: { label: 'Completada', tone: 'positive' },
  cancelada: { label: 'Cancelada', tone: 'critical' },
}

export const WORK_ORDER_PRIORITY: LabelMap = {
  baja: { label: 'Baja', tone: 'neutral' },
  media: { label: 'Media', tone: 'info' },
  alta: { label: 'Alta', tone: 'warning' },
  critica: { label: 'Crítica', tone: 'critical' },
}

export const WORK_ORDER_TYPE: LabelMap = {
  preventivo: { label: 'Preventivo', tone: 'neutral' },
  correctivo: { label: 'Correctivo', tone: 'neutral' },
  programado: { label: 'Programado', tone: 'neutral' },
  inspeccion: { label: 'Inspección', tone: 'neutral' },
  instalacion: { label: 'Instalación', tone: 'neutral' },
  emergencia: { label: 'Emergencia', tone: 'critical' },
}

// --- Purchasing ------------------------------------------------------------

export const PURCHASE_ORDER_STATE: LabelMap = {
  borrador: { label: 'Borrador', tone: 'neutral' },
  enviada: { label: 'Enviada', tone: 'info' },
  aprobada: { label: 'Aprobada', tone: 'accent' },
  recibida_parcial: { label: 'Recepción parcial', tone: 'warning' },
  recibida: { label: 'Recibida', tone: 'positive' },
  cancelada: { label: 'Cancelada', tone: 'critical' },
}

export const SUPPLIER_CATEGORY: LabelMap = {
  alquileres: { label: 'Alquileres', tone: 'neutral' },
  combustible: { label: 'Combustible', tone: 'neutral' },
  epp: { label: 'EPP', tone: 'neutral' },
  logistica: { label: 'Logística', tone: 'neutral' },
  materiales: { label: 'Materiales', tone: 'neutral' },
  repuestos: { label: 'Repuestos', tone: 'neutral' },
  servicios: { label: 'Servicios', tone: 'neutral' },
  subcontrato: { label: 'Subcontrato', tone: 'neutral' },
}

// --- Stock -----------------------------------------------------------------

export const ARTICLE_CATEGORY: LabelMap = {
  combustible: { label: 'Combustible', tone: 'neutral' },
  consumible: { label: 'Consumible', tone: 'neutral' },
  electrico: { label: 'Eléctrico', tone: 'neutral' },
  epp: { label: 'EPP', tone: 'neutral' },
  ferreteria: { label: 'Ferretería', tone: 'neutral' },
  lubricante: { label: 'Lubricante', tone: 'neutral' },
  papeleria: { label: 'Papelería', tone: 'neutral' },
  quimico: { label: 'Químico', tone: 'neutral' },
  repuesto: { label: 'Repuesto', tone: 'neutral' },
}

export const WAREHOUSE_TYPE: LabelMap = {
  central: { label: 'Central', tone: 'neutral' },
  faena: { label: 'Faena', tone: 'neutral' },
  movil: { label: 'Móvil', tone: 'neutral' },
}

// --- Equipment -------------------------------------------------------------

export const EQUIPMENT_STATE: LabelMap = {
  disponible: { label: 'Disponible', tone: 'positive' },
  asignado: { label: 'Asignado', tone: 'info' },
  en_calibracion: { label: 'En calibración', tone: 'warning' },
  en_mantenimiento: { label: 'En mantenimiento', tone: 'warning' },
  fuera_servicio: { label: 'Fuera de servicio', tone: 'critical' },
  baja: { label: 'Baja', tone: 'neutral' },
}

export const EQUIPMENT_CATEGORY: LabelMap = {
  andamio: { label: 'Andamio', tone: 'neutral' },
  bomba: { label: 'Bomba', tone: 'neutral' },
  compresor: { label: 'Compresor', tone: 'neutral' },
  epp: { label: 'EPP', tone: 'neutral' },
  equipo_pesado: { label: 'Equipo pesado', tone: 'neutral' },
  generador: { label: 'Generador', tone: 'neutral' },
  herramienta_electrica: { label: 'Herramienta eléctrica', tone: 'neutral' },
  herramienta_manual: { label: 'Herramienta manual', tone: 'neutral' },
  instrumento_medicion: { label: 'Instrumento de medición', tone: 'neutral' },
  soldadora: { label: 'Soldadora', tone: 'neutral' },
}

// --- Fleet -----------------------------------------------------------------

export const VEHICLE_STATE: LabelMap = {
  operativo: { label: 'Operativo', tone: 'positive' },
  en_mantenimiento: { label: 'En mantenimiento', tone: 'warning' },
  fuera_servicio: { label: 'Fuera de servicio', tone: 'critical' },
  baja: { label: 'Baja', tone: 'neutral' },
}

export const VEHICLE_TYPE: LabelMap = {
  ambulancia: { label: 'Ambulancia', tone: 'neutral' },
  camion: { label: 'Camión', tone: 'neutral' },
  camioneta: { label: 'Camioneta', tone: 'neutral' },
  cisterna: { label: 'Cisterna', tone: 'neutral' },
  grua: { label: 'Grúa', tone: 'neutral' },
  hormigonera: { label: 'Hormigonera', tone: 'neutral' },
  minibus: { label: 'Minibús', tone: 'neutral' },
  tractor_semi: { label: 'Tractor con semirremolque', tone: 'neutral' },
  utilitario: { label: 'Utilitario', tone: 'neutral' },
}

// --- Human resources -------------------------------------------------------

export const EMPLOYEE_STATE: LabelMap = {
  activo: { label: 'Activo', tone: 'positive' },
  licencia: { label: 'En licencia', tone: 'info' },
  suspendido: { label: 'Suspendido', tone: 'warning' },
  baja: { label: 'Baja', tone: 'neutral' },
}

export const EMPLOYEE_AREA: LabelMap = {
  administracion: { label: 'Administración', tone: 'neutral' },
  comercial: { label: 'Comercial', tone: 'neutral' },
  deposito: { label: 'Depósito', tone: 'neutral' },
  direccion: { label: 'Dirección', tone: 'neutral' },
  logistica: { label: 'Logística', tone: 'neutral' },
  mantenimiento: { label: 'Mantenimiento', tone: 'neutral' },
  operaciones: { label: 'Operaciones', tone: 'neutral' },
  seguridad_higiene: { label: 'Seguridad e higiene', tone: 'neutral' },
}

export const SHIFT_PATTERN: LabelMap = {
  '14x14': { label: '14x14', tone: 'neutral' },
  '7x7': { label: '7x7', tone: 'neutral' },
  '4x3': { label: '4x3', tone: 'neutral' },
  guardia: { label: 'Guardia', tone: 'neutral' },
  jornada: { label: 'Jornada', tone: 'neutral' },
}

// --- Invoicing -------------------------------------------------------------

export const INVOICE_STATE: LabelMap = {
  emitida: { label: 'Emitida', tone: 'info' },
  enviada: { label: 'Enviada', tone: 'info' },
  cobrada: { label: 'Cobrada', tone: 'positive' },
  vencida: { label: 'Vencida', tone: 'critical' },
  anulada: { label: 'Anulada', tone: 'neutral' },
}

export const INVOICE_TYPE: LabelMap = {
  factura_a: { label: 'Factura A', tone: 'neutral' },
  factura_b: { label: 'Factura B', tone: 'neutral' },
  factura_c: { label: 'Factura C', tone: 'neutral' },
  nota_credito: { label: 'Nota de crédito', tone: 'warning' },
  nota_debito: { label: 'Nota de débito', tone: 'info' },
}

/** Receivables aging buckets, ordered by `orden_tramo` in the view. */
export const AGING_BUCKET: LabelMap = {
  corriente: { label: 'Corriente', tone: 'positive' },
  '1-30': { label: '1 a 30 días', tone: 'accent' },
  '31-60': { label: '31 a 60 días', tone: 'warning' },
  '61-90': { label: '61 a 90 días', tone: 'warning' },
  '+90': { label: 'Más de 90 días', tone: 'critical' },
}

// --- Documents -------------------------------------------------------------

export const DOCUMENT_TYPE: LabelMap = {
  certificado: { label: 'Certificado', tone: 'neutral' },
  contrato: { label: 'Contrato', tone: 'neutral' },
  foto: { label: 'Fotografía', tone: 'neutral' },
  habilitacion: { label: 'Habilitación', tone: 'neutral' },
  informe: { label: 'Informe', tone: 'neutral' },
  manual: { label: 'Manual', tone: 'neutral' },
  plano: { label: 'Plano', tone: 'neutral' },
  poliza: { label: 'Póliza', tone: 'neutral' },
  procedimiento: { label: 'Procedimiento', tone: 'neutral' },
  remito: { label: 'Remito', tone: 'neutral' },
}

export const DOCUMENT_ENTITY: LabelMap = {
  cliente: { label: 'Cliente', tone: 'neutral' },
  empleado: { label: 'Empleado', tone: 'neutral' },
  equipo: { label: 'Equipo', tone: 'neutral' },
  vehiculo: { label: 'Vehículo', tone: 'neutral' },
  proyecto: { label: 'Proyecto', tone: 'neutral' },
  orden_trabajo: { label: 'Orden de trabajo', tone: 'neutral' },
}

/** Document expiry buckets, ordered by `orden_tramo` in the view. */
export const DOCUMENT_EXPIRY_BUCKET: LabelMap = {
  vencido: { label: 'Vencidos', tone: 'critical' },
  '30_dias': { label: 'Vencen en 30 días', tone: 'warning' },
  '60_dias': { label: 'Vencen en 60 días', tone: 'accent' },
  '90_dias': { label: 'Vencen en 90 días', tone: 'info' },
}
