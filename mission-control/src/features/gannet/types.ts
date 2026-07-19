/**
 * Row shapes for the `public.gd_*` demo views.
 *
 * These mirror the view definitions in
 * `supabase/migrations/20260719000002_gannet_demo_vistas.sql`. Only the columns
 * the modules actually consume are declared — the views expose more, and adding
 * a field here is a one-line change when a module needs it.
 *
 * Column names stay in Spanish because they are database identifiers, not our
 * naming choice. Types follow PostgREST's JSON serialization, verified against
 * the live database: `numeric` and `bigint` both arrive as unquoted JSON
 * numbers, `date` and `timestamptz` as ISO strings.
 */

// --- Executive dashboard ---------------------------------------------------

export type KpiEjecutivo = {
  facturacion_mes_ars: number | null
  facturacion_ytd_ars: number | null
  cobranza_pendiente_ars: number | null
  cobranza_vencida_ars: number | null
  facturas_pendientes: number | null
  ot_abiertas: number | null
  ot_criticas: number | null
  ot_en_ejecucion: number | null
  ot_completadas_mes: number | null
  incidentes_seguridad_mes: number | null
  proyectos_activos: number | null
  pipeline_abierto_ars: number | null
  tasa_conversion_pct: number | null
  dotacion_activa: number | null
  clientes_activos: number | null
  flota_operativa: number | null
  flota_total: number | null
  equipos_disponibles: number | null
  equipos_total: number | null
  calculado_en: string | null
}

// --- Clients ---------------------------------------------------------------

export type Cliente = {
  cliente_id: number
  cliente: string
  razon_social: string | null
  cuit: string | null
  mineral_principal: string | null
  provincia: string | null
  localidad: string | null
  estado: string | null
  condicion_pago_dias: number | null
  limite_credito_ars: number | null
  ejecutivo_cuenta: string | null
  faenas: number | null
  contactos: number | null
  proyectos_activos: number | null
  ot_abiertas: number | null
  facturado_ars: number | null
  saldo_pendiente_ars: number | null
}

export type ClienteDetalle = {
  cliente_id: number
  cliente: string
  razon_social: string | null
  cuit: string | null
  mineral_principal: string | null
  provincia: string | null
  localidad: string | null
  sitio_web: string | null
  estado_cliente: string | null
  condicion_pago_dias: number | null
  limite_credito_ars: number | null
  fecha_alta: string | null
  ejecutivo_cuenta: string | null
  contacto_principal: string | null
  contacto_principal_cargo: string | null
  contacto_principal_email: string | null
  contacto_principal_telefono: string | null
  contactos_activos: number | null
  faenas_activas: number | null
  faenas: string | null
  proyectos_total: number | null
  proyectos_activos: number | null
  contratado_ars: number | null
  ejecutado_ars: number | null
  ot_total: number | null
  ot_abiertas: number | null
  ot_criticas: number | null
  horas_ejecutadas: number | null
  incidentes_seguridad: number | null
  cotizaciones_total: number | null
  cotizaciones_abiertas: number | null
  pipeline_abierto_ars: number | null
  tasa_conversion_pct: number | null
  facturado_total_ars: number | null
  facturado_ytd_ars: number | null
  saldo_pendiente_ars: number | null
  saldo_vencido_ars: number | null
  ultima_factura_el: string | null
  documentos_total: number | null
  ultima_actividad_en: string | null
  ultima_actividad: string | null
}

// --- Quotes ----------------------------------------------------------------

export type Cotizacion = {
  cotizacion_id: number
  numero: string
  estado: string
  fecha_emision: string | null
  fecha_validez: string | null
  dias_de_validez_restantes: number | null
  fuera_de_validez: boolean | null
  total_ars: number | null
  probabilidad_pct: number | null
  total_ponderado_ars: number | null
  cliente: string | null
  proyecto: string | null
  servicio_principal: string | null
  responsable_comercial: string | null
  items: number | null
}

export type PipelineCotizaciones = {
  estado: string
  orden_embudo: number | null
  etiqueta: string | null
  es_pipeline_abierto: boolean | null
  cantidad: number | null
  monto_nominal_ars: number | null
  monto_ponderado_ars: number | null
  probabilidad_promedio_pct: number | null
  ticket_promedio_ars: number | null
  clientes_alcanzados: number | null
  fuera_de_validez: number | null
}

// --- Projects --------------------------------------------------------------

export type ProyectoEstado = {
  proyecto_id: number
  proyecto_codigo: string
  proyecto: string
  cliente: string | null
  faena: string | null
  servicio: string | null
  responsable: string | null
  tipo_contrato: string | null
  estado: string
  fecha_inicio_plan: string | null
  fecha_fin_plan: string | null
  avance_pct: number | null
  monto_contrato_ars: number | null
  monto_ejecutado_ars: number | null
  avance_economico_pct: number | null
  desvio_presupuestario_pp: number | null
  dias_atraso: number | null
  esta_vencido: boolean | null
  dias_para_fin_plan: number | null
  ot_total: number | null
  ot_abiertas: number | null
  facturado_ars: number | null
}

// --- Work orders -----------------------------------------------------------

export type OtOperativa = {
  ot_id: number
  ot_numero: string
  titulo: string
  tipo: string | null
  prioridad: string
  estado: string
  esta_abierta: boolean | null
  cliente: string | null
  proyecto_codigo: string | null
  faena: string | null
  faena_provincia: string | null
  servicio: string | null
  responsable: string | null
  responsable_area: string | null
  vehiculo_dominio: string | null
  equipo_codigo: string | null
  fecha_programada: string | null
  horas_estimadas: number | null
  horas_reales: number | null
  desvio_horas: number | null
  costo_total_ars: number | null
  monto_facturable_ars: number | null
  margen_ars: number | null
  incidentes_seguridad: number | null
  dotacion_asignada: number | null
  dias_para_fecha_programada: number | null
  esta_atrasada: boolean | null
}

export type OtCargaOperativa = {
  estado: string
  prioridad: string
  orden_estado: number | null
  orden_prioridad: number | null
  esta_abierta: boolean | null
  cantidad: number | null
  horas_estimadas: number | null
  horas_reales: number | null
  monto_facturable_ars: number | null
  atrasadas: number | null
}

// --- Purchasing ------------------------------------------------------------

export type OrdenCompra = {
  orden_compra_id: number
  numero: string
  estado: string
  fecha_emision: string | null
  fecha_entrega_estimada: string | null
  fecha_recepcion: string | null
  dias_desvio_entrega: number | null
  entregada_en_plazo: boolean | null
  entrega_atrasada: boolean | null
  total_ars: number | null
  proveedor: string | null
  proveedor_rubro: string | null
  proyecto: string | null
  ot_numero: string | null
  solicitante: string | null
  deposito_destino: string | null
  items: number | null
}

export type CompraPorProveedor = {
  proveedor_id: number
  proveedor: string
  rubro: string | null
  calificacion: number | null
  condicion_pago_dias: number | null
  activo: boolean | null
  oc_total: number | null
  oc_en_curso: number | null
  oc_recibidas: number | null
  monto_total_ars: number | null
  monto_ytd_ars: number | null
  ticket_promedio_ars: number | null
  cumplimiento_plazo_pct: number | null
  dias_desvio_promedio: number | null
  ultima_compra_el: string | null
}

// --- Stock -----------------------------------------------------------------

export type Articulo = {
  articulo_id: number
  codigo: string
  articulo: string
  categoria: string | null
  unidad_medida: string | null
  stock_minimo: number | null
  costo_unitario_ars: number | null
  activo: boolean | null
  stock_total: number | null
  depositos_con_stock: number | null
  valorizado_ars: number | null
  bajo_minimo: boolean | null
  ultimo_movimiento_en: string | null
  veces_comprado: number | null
}

export type StockCritico = {
  stock_id: number
  articulo_codigo: string
  articulo: string
  articulo_categoria: string | null
  unidad_medida: string | null
  deposito: string | null
  deposito_tipo: string | null
  deposito_responsable: string | null
  cantidad_actual: number | null
  stock_minimo: number | null
  faltante: number | null
  cobertura_pct: number | null
  costo_reposicion_ars: number | null
  sin_existencia: boolean | null
  compras_en_curso: number | null
}

// --- Equipment -------------------------------------------------------------

export type Equipo = {
  equipo_id: number
  codigo_interno: string
  equipo: string
  categoria: string | null
  marca: string | null
  modelo: string | null
  estado: string
  es_alquilable: boolean | null
  tarifa_dia_ars: number | null
  valor_ars: number | null
  proxima_calibracion: string | null
  dias_para_calibracion: number | null
  calibracion_vencida: boolean | null
  servicio: string | null
  deposito: string | null
  responsable: string | null
  ot_en_curso: number | null
  mantenimientos: number | null
}

export type EquipoDisponibilidad = {
  categoria: string
  estado: string
  esta_disponible: boolean | null
  cantidad: number | null
  alquilables: number | null
  valor_total_ars: number | null
  calibraciones_vencidas: number | null
  calibraciones_por_vencer_30d: number | null
  calibracion_mas_proxima: string | null
  servicios_asociados: string | null
}

// --- Fleet -----------------------------------------------------------------

export type FlotaEstado = {
  vehiculo_id: number
  dominio: string
  tipo: string | null
  marca: string | null
  modelo: string | null
  anio: number | null
  antiguedad_anios: number | null
  estado: string
  esta_operativo: boolean | null
  km_actual: number | null
  valor_ars: number | null
  responsable: string | null
  deposito_base: string | null
  vtv_vence_el: string | null
  dias_para_vtv: number | null
  vtv_vencida: boolean | null
  vtv_por_vencer_30d: boolean | null
  seguro_vence_el: string | null
  dias_para_seguro: number | null
  seguro_vencido: boolean | null
  seguro_por_vencer_30d: boolean | null
  ot_en_curso: number | null
  mantenimientos_pendientes: number | null
  ultimo_mantenimiento_el: string | null
}

// --- Human resources -------------------------------------------------------

export type Empleado = {
  empleado_id: number
  legajo: string
  empleado: string
  documento: string | null
  puesto: string | null
  area: string | null
  modalidad_turno: string | null
  estado: string
  email: string | null
  telefono: string | null
  fecha_ingreso: string | null
  antiguedad_anios: number | null
  costo_hora_ars: number | null
  especialidad: string | null
  supervisor: string | null
  ot_abiertas: number | null
  horas_mes: number | null
  ausencias_mes: number | null
}

export type RrhhResumen = {
  area: string
  dotacion_total: number | null
  dotacion_activa: number | null
  en_licencia: number | null
  suspendidos: number | null
  bajas: number | null
  costo_hora_promedio_ars: number | null
  antiguedad_promedio_anios: number | null
  horas_mes: number | null
  costo_horas_mes_ars: number | null
  accidentes_mes: number | null
  ausentismo_pct: number | null
  ot_abiertas_a_cargo: number | null
  incidentes_seguridad_ytd: number | null
}

// --- Invoicing -------------------------------------------------------------

export type Factura = {
  factura_id: number
  numero: string
  tipo_comprobante: string | null
  estado: string
  fecha_emision: string | null
  fecha_vencimiento: string | null
  fecha_cobro: string | null
  neto_ars: number | null
  total_ars: number | null
  esta_pendiente: boolean | null
  dias_vencido: number | null
  dias_para_vencer: number | null
  cliente: string | null
  condicion_pago_dias: number | null
  proyecto: string | null
  ot_numero: string | null
}

export type CobranzaAging = {
  cliente_id: number
  cliente: string
  estado_cliente: string | null
  condicion_pago_dias: number | null
  tramo: string
  orden_tramo: number | null
  etiqueta_tramo: string | null
  facturas: number | null
  monto_ars: number | null
  dias_vencido_promedio: number | null
  dias_vencido_maximo: number | null
  vencimiento_mas_antiguo: string | null
}

// --- Documents -------------------------------------------------------------

export type Documento = {
  documento_id: number
  documento: string
  tipo: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  dias_para_vencer: number | null
  esta_vencido: boolean | null
  entidad_tipo: string | null
  entidad_nombre: string | null
  tamano_kb: number | null
}

export type DocumentoVencimiento = {
  documento_id: number
  documento: string
  documento_tipo: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  dias_para_vencer: number | null
  tramo: string
  orden_tramo: number | null
  esta_vencido: boolean | null
  entidad_tipo: string | null
  entidad_nombre: string | null
}
