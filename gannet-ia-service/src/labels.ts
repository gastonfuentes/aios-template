/**
 * Display labels for the enumerated snake_case values the demo views store.
 *
 * Ported from mission-control's `features/gannet/labels.ts` so the AI narrates
 * the SAME accented Spanish the module screens show. The system prompt requires
 * every figure AND label to match the projector letter for letter, but the
 * database keeps states as unaccented snake_case (`en_negociacion`,
 * `seguridad_higiene`) and accents cannot be recovered mechanically — so each
 * closed set is mapped explicitly here, exactly as the UI does. This service is
 * a separate process and cannot import the module's map; if the module labels
 * change, change these too.
 *
 * Only the `label` string is carried (the UI's tone/colour is irrelevant to a
 * text answer). `label()` falls back to a humanized version of the raw value so
 * an unmapped state renders readably instead of leaking snake_case to the stage.
 */

/** Resolves a raw database value against a map, humanizing anything unmapped. */
export function label(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  const mapped = map[value]
  if (mapped !== undefined) return mapped
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export const WORK_ORDER_STATE: Record<string, string> = {
  borrador: 'Borrador',
  programada: 'Programada',
  en_ejecucion: 'En ejecución',
  pausada: 'Pausada',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export const WORK_ORDER_PRIORITY: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
}

export const VEHICLE_STATE: Record<string, string> = {
  operativo: 'Operativo',
  en_mantenimiento: 'En mantenimiento',
  fuera_servicio: 'Fuera de servicio',
  baja: 'Baja',
}

export const VEHICLE_TYPE: Record<string, string> = {
  ambulancia: 'Ambulancia',
  camion: 'Camión',
  camioneta: 'Camioneta',
  cisterna: 'Cisterna',
  grua: 'Grúa',
  hormigonera: 'Hormigonera',
  minibus: 'Minibús',
  tractor_semi: 'Tractor con semirremolque',
  utilitario: 'Utilitario',
}

export const PROJECT_STATE: Record<string, string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  suspendido: 'Suspendido',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
}

export const EMPLOYEE_AREA: Record<string, string> = {
  administracion: 'Administración',
  comercial: 'Comercial',
  deposito: 'Depósito',
  direccion: 'Dirección',
  logistica: 'Logística',
  mantenimiento: 'Mantenimiento',
  operaciones: 'Operaciones',
  seguridad_higiene: 'Seguridad e higiene',
}

export const EQUIPMENT_STATE: Record<string, string> = {
  disponible: 'Disponible',
  asignado: 'Asignado',
  en_calibracion: 'En calibración',
  en_mantenimiento: 'En mantenimiento',
  fuera_servicio: 'Fuera de servicio',
  baja: 'Baja',
}

export const EQUIPMENT_CATEGORY: Record<string, string> = {
  andamio: 'Andamio',
  bomba: 'Bomba',
  compresor: 'Compresor',
  epp: 'EPP',
  equipo_pesado: 'Equipo pesado',
  generador: 'Generador',
  herramienta_electrica: 'Herramienta eléctrica',
  herramienta_manual: 'Herramienta manual',
  instrumento_medicion: 'Instrumento de medición',
  soldadora: 'Soldadora',
}

export const DOCUMENT_ENTITY: Record<string, string> = {
  cliente: 'Cliente',
  empleado: 'Empleado',
  equipo: 'Equipo',
  vehiculo: 'Vehículo',
  proyecto: 'Proyecto',
  orden_trabajo: 'Orden de trabajo',
}

export const DOCUMENT_TYPE: Record<string, string> = {
  certificado: 'Certificado',
  contrato: 'Contrato',
  foto: 'Fotografía',
  habilitacion: 'Habilitación',
  informe: 'Informe',
  manual: 'Manual',
  plano: 'Plano',
  poliza: 'Póliza',
  procedimiento: 'Procedimiento',
  remito: 'Remito',
}

export const ARTICLE_CATEGORY: Record<string, string> = {
  combustible: 'Combustible',
  consumible: 'Consumible',
  electrico: 'Eléctrico',
  epp: 'EPP',
  ferreteria: 'Ferretería',
  lubricante: 'Lubricante',
  papeleria: 'Papelería',
  quimico: 'Químico',
  repuesto: 'Repuesto',
}

export const PURCHASE_ORDER_STATE: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  aprobada: 'Aprobada',
  recibida_parcial: 'Recepción parcial',
  recibida: 'Recibida',
  cancelada: 'Cancelada',
}

export const CLIENT_STATE: Record<string, string> = {
  activo: 'Activo',
  prospecto: 'Prospecto',
  moroso: 'Moroso',
  inactivo: 'Inactivo',
}

export const QUOTE_STATE: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  en_negociacion: 'En negociación',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  vencida: 'Vencida',
}
