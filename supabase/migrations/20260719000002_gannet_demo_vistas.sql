-- =============================================================================
-- VISTAS DE LECTURA `public.gd_*` — Andes Servicios Integrales S.A.
-- =============================================================================
--
-- QUE HACE ESTA MIGRACION
--   Crea la superficie de lectura que consume Mission Control. Las tablas viven
--   en `gannet_demo` con ROW LEVEL SECURITY en negacion por defecto y sin
--   privilegios para `anon` ni `authenticated`. Estas vistas, propiedad de un
--   rol privilegiado y con `security_invoker = false` (comportamiento por
--   defecto), son el UNICO camino por el que la aplicacion accede al dato.
--
-- MODO KIOSCO
--   La demo se presenta sin inicio de sesion, de modo que la aplicacion consulta
--   PostgREST con el rol `anon`. Por eso cada vista recibe SELECT para `anon` y
--   `authenticated`. Todo el dato es ficticio y de solo lectura.
--
-- TRAMPA CONOCIDA DE ESTE PROYECTO — LEER ANTES DE AGREGAR UNA VISTA
--   La base tiene el ajuste por defecto de Supabase:
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT ALL ON TABLES TO anon, authenticated, service_role;
--   En consecuencia, TODA vista nueva en `public` nace con el conjunto completo
--   de privilegios (arwdDxt) para `anon`, y un `GRANT SELECT` posterior no quita
--   nada: es una operacion sin efecto. La unica forma de cerrar la superficie es
--   REVOCAR TODO y recien despues conceder SELECT. Eso es exactamente lo que
--   hace el bloque `PRIVILEGIOS` al final del archivo, que recorre todas las
--   vistas `public.gd_*` y aplica REVOKE ALL seguido de GRANT SELECT.
--   Toda vista `gd_*` agregada en el futuro queda cubierta automaticamente por
--   ese bloque; no hay que escribir grants individuales.
--
-- CONVENCIONES
--   * Prefijo `gd_` (gannet demo) para no colisionar con las vistas legadas
--     `demo_*` del esquema `demo_mineria`.
--   * Toda vista que devuelve entidades expone su `id`, para que el panel pueda
--     navegar al detalle sin volver a resolver por nombre.
--   * Las claves foraneas se devuelven resueltas por nombre Y como id.
--   * Toda ventana temporal se calcula contra `CURRENT_DATE` o `now()`, nunca
--     contra fechas fijas: la demo debe seguir viva el dia del congreso.
--   * Importes monetarios con sufijo `_ars` (pesos argentinos).
--   * `COMMENT ON VIEW` obligatorio: el modulo de IA conversacional los lee como
--     diccionario semantico para traducir preguntas a SQL.
--
-- IDEMPOTENCIA
--   `CREATE OR REPLACE VIEW` en todos los casos, dentro de una unica
--   transaccion. La migracion se puede volver a aplicar sin efectos colaterales.
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- BLOQUE 1 — AGREGACION Y PANEL EJECUTIVO
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. gd_kpi_ejecutivo — fila unica de portada
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_kpi_ejecutivo AS
WITH facturacion AS (
  SELECT
    COALESCE(SUM(total_ars) FILTER (
      WHERE fecha_emision >= date_trunc('month', CURRENT_DATE)::date), 0) AS mes_ars,
    COALESCE(SUM(total_ars) FILTER (
      WHERE fecha_emision >= date_trunc('year', CURRENT_DATE)::date), 0) AS ytd_ars,
    COALESCE(SUM(total_ars) FILTER (
      WHERE estado IN ('emitida', 'enviada', 'vencida')), 0) AS pendiente_ars,
    COALESCE(SUM(total_ars) FILTER (
      WHERE estado = 'vencida'), 0) AS vencido_ars,
    COUNT(*) FILTER (
      WHERE estado IN ('emitida', 'enviada', 'vencida')) AS facturas_pendientes
  FROM gannet_demo.facturas
  WHERE estado <> 'anulada'
),
ordenes AS (
  SELECT
    COUNT(*) FILTER (WHERE estado IN ('programada', 'en_ejecucion', 'pausada')) AS abiertas,
    COUNT(*) FILTER (WHERE estado IN ('programada', 'en_ejecucion', 'pausada')
                       AND prioridad = 'critica') AS criticas,
    COUNT(*) FILTER (WHERE estado = 'en_ejecucion') AS en_ejecucion,
    COUNT(*) FILTER (WHERE estado = 'completada'
                       AND fecha_fin >= date_trunc('month', CURRENT_DATE)) AS completadas_mes,
    COALESCE(SUM(incidentes_seguridad) FILTER (
      WHERE fecha_inicio >= date_trunc('month', CURRENT_DATE)), 0) AS incidentes_mes
  FROM gannet_demo.ordenes_trabajo
),
comercial AS (
  SELECT
    COUNT(*) FILTER (WHERE estado = 'aceptada') AS aceptadas,
    COUNT(*) FILTER (WHERE estado IN ('aceptada', 'rechazada', 'vencida')) AS resueltas,
    COALESCE(SUM(total_ars) FILTER (
      WHERE estado IN ('enviada', 'en_negociacion')), 0) AS pipeline_abierto_ars
  FROM gannet_demo.cotizaciones
)
SELECT
  f.mes_ars                                          AS facturacion_mes_ars,
  f.ytd_ars                                          AS facturacion_ytd_ars,
  f.pendiente_ars                                    AS cobranza_pendiente_ars,
  f.vencido_ars                                      AS cobranza_vencida_ars,
  f.facturas_pendientes                              AS facturas_pendientes,
  o.abiertas                                         AS ot_abiertas,
  o.criticas                                         AS ot_criticas,
  o.en_ejecucion                                     AS ot_en_ejecucion,
  o.completadas_mes                                  AS ot_completadas_mes,
  o.incidentes_mes                                   AS incidentes_seguridad_mes,
  (SELECT COUNT(*) FROM gannet_demo.proyectos
    WHERE estado = 'en_curso')                       AS proyectos_activos,
  c.pipeline_abierto_ars                             AS pipeline_abierto_ars,
  ROUND(100.0 * c.aceptadas / NULLIF(c.resueltas, 0), 1) AS tasa_conversion_pct,
  (SELECT COUNT(*) FROM gannet_demo.empleados
    WHERE estado = 'activo')                         AS dotacion_activa,
  (SELECT COUNT(*) FROM gannet_demo.clientes
    WHERE estado = 'activo')                         AS clientes_activos,
  (SELECT COUNT(*) FROM gannet_demo.vehiculos
    WHERE estado = 'operativo')                      AS flota_operativa,
  (SELECT COUNT(*) FROM gannet_demo.vehiculos
    WHERE estado <> 'baja')                          AS flota_total,
  (SELECT COUNT(*) FROM gannet_demo.equipos
    WHERE estado = 'disponible')                     AS equipos_disponibles,
  (SELECT COUNT(*) FROM gannet_demo.equipos
    WHERE estado <> 'baja')                          AS equipos_total,
  now()                                              AS calculado_en
FROM facturacion f
CROSS JOIN ordenes o
CROSS JOIN comercial c;

COMMENT ON VIEW public.gd_kpi_ejecutivo IS
  'Fila unica con los indicadores de portada del panel ejecutivo: facturacion del mes y del ano en curso, cobranza pendiente y vencida, ordenes de trabajo abiertas y criticas, proyectos activos, tasa de conversion comercial, dotacion activa, flota operativa y equipos disponibles. Todos los valores se recalculan contra la fecha actual en cada consulta.';

-- -----------------------------------------------------------------------------
-- 2. gd_facturacion_mensual — serie de 18 meses
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_facturacion_mensual AS
WITH meses AS (
  SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '17 months',
           date_trunc('month', CURRENT_DATE),
           INTERVAL '1 month')::date AS mes
)
SELECT
  m.mes,
  to_char(m.mes, 'YYYY-MM')                                    AS periodo,
  to_char(m.mes, 'TMMon YYYY')                                 AS etiqueta,
  COALESCE(e.emitido_ars, 0)                                   AS emitido_ars,
  COALESCE(c.cobrado_ars, 0)                                   AS cobrado_ars,
  COALESCE(e.emitido_ars, 0) - COALESCE(c.cobrado_ars, 0)      AS brecha_ars,
  COALESCE(e.facturas_emitidas, 0)                             AS facturas_emitidas,
  COALESCE(c.facturas_cobradas, 0)                             AS facturas_cobradas,
  ROUND(100.0 * COALESCE(c.cobrado_ars, 0)
        / NULLIF(COALESCE(e.emitido_ars, 0), 0), 1)            AS cobrado_sobre_emitido_pct
FROM meses m
LEFT JOIN (
  SELECT date_trunc('month', fecha_emision)::date AS mes,
         SUM(total_ars)                           AS emitido_ars,
         COUNT(*)                                 AS facturas_emitidas
  FROM gannet_demo.facturas
  WHERE estado <> 'anulada' AND fecha_emision IS NOT NULL
  GROUP BY 1
) e ON e.mes = m.mes
LEFT JOIN (
  SELECT date_trunc('month', fecha_cobro)::date AS mes,
         SUM(total_ars)                         AS cobrado_ars,
         COUNT(*)                               AS facturas_cobradas
  FROM gannet_demo.facturas
  WHERE estado = 'cobrada' AND fecha_cobro IS NOT NULL
  GROUP BY 1
) c ON c.mes = m.mes
ORDER BY m.mes;

COMMENT ON VIEW public.gd_facturacion_mensual IS
  'Serie temporal de los ultimos dieciocho meses cerrados hasta el mes en curso, con el monto emitido y el monto cobrado en cada mes, su brecha y el porcentaje cobrado sobre emitido. Alimenta el grafico principal de evolucion de ingresos. Los meses sin movimiento aparecen igualmente con valor cero para que la serie no tenga huecos.';

-- -----------------------------------------------------------------------------
-- 3. gd_ingresos_por_servicio — las diez lineas de negocio
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_ingresos_por_servicio AS
WITH facturado AS (
  -- El servicio de una factura se resuelve por la orden de trabajo que la
  -- origina y, en su defecto, por el proyecto al que se imputa.
  SELECT
    COALESCE(ot.servicio_id, p.servicio_id) AS servicio_id,
    SUM(f.total_ars)                        AS facturado_ars
  FROM gannet_demo.facturas f
  LEFT JOIN gannet_demo.ordenes_trabajo ot ON ot.id = f.orden_trabajo_id
  LEFT JOIN gannet_demo.proyectos       p  ON p.id  = f.proyecto_id
  WHERE f.estado <> 'anulada'
    AND COALESCE(ot.servicio_id, p.servicio_id) IS NOT NULL
  GROUP BY 1
),
operacion AS (
  SELECT
    servicio_id,
    COUNT(*)                                                      AS ot_total,
    COUNT(*) FILTER (WHERE estado = 'completada')                 AS ot_completadas,
    COUNT(*) FILTER (WHERE estado IN ('programada','en_ejecucion','pausada')) AS ot_abiertas,
    COALESCE(SUM(horas_reales), 0)                                AS horas_reales,
    COALESCE(SUM(horas_estimadas), 0)                             AS horas_estimadas,
    COALESCE(SUM(monto_facturable_ars), 0)                        AS monto_ot_ars,
    COALESCE(SUM(costo_mano_obra_ars + costo_materiales_ars), 0)  AS costo_ot_ars
  FROM gannet_demo.ordenes_trabajo
  GROUP BY 1
)
SELECT
  s.id                                       AS servicio_id,
  s.codigo                                   AS servicio_codigo,
  s.nombre                                   AS servicio,
  s.unidad_facturacion,
  s.color_hex,
  COALESCE(fa.facturado_ars, 0)              AS facturado_ars,
  COALESCE(op.monto_ot_ars, 0)               AS monto_ot_ars,
  COALESCE(op.costo_ot_ars, 0)               AS costo_ot_ars,
  COALESCE(op.monto_ot_ars, 0) - COALESCE(op.costo_ot_ars, 0) AS margen_ot_ars,
  ROUND(100.0 * (COALESCE(op.monto_ot_ars, 0) - COALESCE(op.costo_ot_ars, 0))
        / NULLIF(op.monto_ot_ars, 0), 1)     AS margen_ot_pct,
  COALESCE(op.ot_total, 0)                   AS ot_total,
  COALESCE(op.ot_completadas, 0)             AS ot_completadas,
  COALESCE(op.ot_abiertas, 0)                AS ot_abiertas,
  COALESCE(op.horas_reales, 0)               AS horas_reales,
  COALESCE(op.horas_estimadas, 0)            AS horas_estimadas,
  (SELECT COUNT(*) FROM gannet_demo.proyectos pr
    WHERE pr.servicio_id = s.id AND pr.estado = 'en_curso') AS proyectos_activos,
  (SELECT COUNT(*) FROM gannet_demo.empleados em
    WHERE em.especialidad_servicio_id = s.id AND em.estado = 'activo') AS especialistas_activos,
  ROUND(100.0 * COALESCE(fa.facturado_ars, 0)
        / NULLIF(SUM(COALESCE(fa.facturado_ars, 0)) OVER (), 0), 1) AS participacion_pct
FROM gannet_demo.servicios s
LEFT JOIN facturado  fa ON fa.servicio_id = s.id
LEFT JOIN operacion  op ON op.servicio_id = s.id
ORDER BY COALESCE(fa.facturado_ars, 0) DESC;

COMMENT ON VIEW public.gd_ingresos_por_servicio IS
  'Una fila por cada una de las diez lineas de servicio de Andes, con lo facturado, el monto y el costo de sus ordenes de trabajo, el margen resultante, la cantidad de ordenes, las horas insumidas, los proyectos activos, los especialistas asignados y la participacion porcentual sobre el total facturado. Es la evidencia cuantitativa de que la empresa es multidisciplinaria.';

-- -----------------------------------------------------------------------------
-- 4. gd_ranking_clientes — cartera ordenada por facturacion
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_ranking_clientes AS
WITH fact AS (
  SELECT cliente_id,
         SUM(total_ars) FILTER (WHERE estado <> 'anulada')                 AS total_ars,
         SUM(total_ars) FILTER (WHERE estado <> 'anulada'
              AND fecha_emision >= date_trunc('month', CURRENT_DATE)::date) AS mes_ars,
         SUM(total_ars) FILTER (WHERE estado IN ('emitida','enviada','vencida')) AS saldo_ars,
         SUM(total_ars) FILTER (WHERE estado = 'vencida')                  AS vencido_ars,
         COUNT(*) FILTER (WHERE estado <> 'anulada')                       AS facturas
  FROM gannet_demo.facturas
  GROUP BY 1
),
ots AS (
  SELECT cliente_id,
         COUNT(*)                                                          AS ot_total,
         COUNT(*) FILTER (WHERE estado IN ('programada','en_ejecucion','pausada')) AS ot_abiertas
  FROM gannet_demo.ordenes_trabajo
  GROUP BY 1
),
proy AS (
  SELECT cliente_id,
         COUNT(*)                                        AS proyectos_total,
         COUNT(*) FILTER (WHERE estado = 'en_curso')      AS proyectos_activos,
         COALESCE(SUM(monto_contrato_ars), 0)             AS contratado_ars
  FROM gannet_demo.proyectos
  GROUP BY 1
),
act AS (
  SELECT cliente_id, MAX(fecha) AS ultima_actividad_en
  FROM gannet_demo.actividades
  WHERE cliente_id IS NOT NULL AND fecha <= now()
  GROUP BY 1
)
SELECT
  c.id                                                AS cliente_id,
  COALESCE(c.nombre_comercial, c.razon_social)        AS cliente,
  c.razon_social,
  c.cuit,
  c.estado                                            AS estado_cliente,
  c.mineral_principal,
  c.provincia,
  c.ejecutivo_cuenta_id,
  (e.nombre || ' ' || e.apellido)                     AS ejecutivo_cuenta,
  COALESCE(f.total_ars, 0)                            AS facturado_total_ars,
  COALESCE(f.mes_ars, 0)                              AS facturado_mes_ars,
  COALESCE(f.saldo_ars, 0)                            AS saldo_pendiente_ars,
  COALESCE(f.vencido_ars, 0)                          AS saldo_vencido_ars,
  COALESCE(f.facturas, 0)                             AS facturas_emitidas,
  c.limite_credito_ars,
  ROUND(100.0 * COALESCE(f.saldo_ars, 0)
        / NULLIF(c.limite_credito_ars, 0), 1)         AS uso_credito_pct,
  COALESCE(o.ot_total, 0)                             AS ot_total,
  COALESCE(o.ot_abiertas, 0)                          AS ot_abiertas,
  COALESCE(p.proyectos_total, 0)                      AS proyectos_total,
  COALESCE(p.proyectos_activos, 0)                    AS proyectos_activos,
  COALESCE(p.contratado_ars, 0)                       AS contratado_ars,
  a.ultima_actividad_en,
  (CURRENT_DATE - a.ultima_actividad_en::date)        AS dias_sin_actividad,
  ROW_NUMBER() OVER (ORDER BY COALESCE(f.total_ars, 0) DESC, c.id) AS posicion
FROM gannet_demo.clientes c
LEFT JOIN gannet_demo.empleados e ON e.id = c.ejecutivo_cuenta_id
LEFT JOIN fact f ON f.cliente_id = c.id
LEFT JOIN ots  o ON o.cliente_id = c.id
LEFT JOIN proy p ON p.cliente_id = c.id
LEFT JOIN act  a ON a.cliente_id = c.id
ORDER BY COALESCE(f.total_ars, 0) DESC, c.id;

COMMENT ON VIEW public.gd_ranking_clientes IS
  'Cartera de clientes ordenada por facturacion historica, con facturado total y del mes, saldo pendiente y vencido, uso del limite de credito, ordenes de trabajo abiertas, proyectos activos, monto contratado, ejecutivo de cuenta y dias transcurridos desde la ultima actividad registrada. Incluye cliente_id para navegar al detalle.';

-- -----------------------------------------------------------------------------
-- 5. gd_cliente_detalle — vista 360 para el panel de drill-down
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_cliente_detalle AS
SELECT
  c.id                                          AS cliente_id,
  COALESCE(c.nombre_comercial, c.razon_social)  AS cliente,
  c.razon_social,
  c.nombre_comercial,
  c.cuit,
  c.mineral_principal,
  c.provincia,
  c.localidad,
  c.sitio_web,
  c.estado                                      AS estado_cliente,
  c.condicion_pago_dias,
  c.limite_credito_ars,
  c.fecha_alta,
  (CURRENT_DATE - c.fecha_alta)                 AS antiguedad_dias,
  c.ejecutivo_cuenta_id,
  (e.nombre || ' ' || e.apellido)               AS ejecutivo_cuenta,
  e.email                                       AS ejecutivo_email,
  cp.id                                         AS contacto_principal_id,
  (cp.nombre || ' ' || cp.apellido)             AS contacto_principal,
  cp.cargo                                      AS contacto_principal_cargo,
  cp.email                                      AS contacto_principal_email,
  cp.telefono                                   AS contacto_principal_telefono,
  (SELECT COUNT(*) FROM gannet_demo.contactos x
     WHERE x.cliente_id = c.id AND x.activo)                                  AS contactos_activos,
  (SELECT COUNT(*) FROM gannet_demo.faenas x
     WHERE x.cliente_id = c.id AND x.activa)                                  AS faenas_activas,
  (SELECT string_agg(x.nombre, ', ' ORDER BY x.nombre) FROM gannet_demo.faenas x
     WHERE x.cliente_id = c.id AND x.activa)                                  AS faenas,
  (SELECT COUNT(*) FROM gannet_demo.proyectos x
     WHERE x.cliente_id = c.id)                                               AS proyectos_total,
  (SELECT COUNT(*) FROM gannet_demo.proyectos x
     WHERE x.cliente_id = c.id AND x.estado = 'en_curso')                     AS proyectos_activos,
  (SELECT COALESCE(SUM(x.monto_contrato_ars), 0) FROM gannet_demo.proyectos x
     WHERE x.cliente_id = c.id)                                               AS contratado_ars,
  (SELECT COALESCE(SUM(x.monto_ejecutado_ars), 0) FROM gannet_demo.proyectos x
     WHERE x.cliente_id = c.id)                                               AS ejecutado_ars,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.cliente_id = c.id)                                               AS ot_total,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.cliente_id = c.id
       AND x.estado IN ('programada','en_ejecucion','pausada'))               AS ot_abiertas,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.cliente_id = c.id
       AND x.estado IN ('programada','en_ejecucion','pausada')
       AND x.prioridad = 'critica')                                           AS ot_criticas,
  (SELECT COALESCE(SUM(x.horas_reales), 0) FROM gannet_demo.ordenes_trabajo x
     WHERE x.cliente_id = c.id)                                               AS horas_ejecutadas,
  (SELECT COALESCE(SUM(x.incidentes_seguridad), 0) FROM gannet_demo.ordenes_trabajo x
     WHERE x.cliente_id = c.id)                                               AS incidentes_seguridad,
  (SELECT COUNT(*) FROM gannet_demo.cotizaciones x
     WHERE x.cliente_id = c.id)                                               AS cotizaciones_total,
  (SELECT COUNT(*) FROM gannet_demo.cotizaciones x
     WHERE x.cliente_id = c.id AND x.estado IN ('enviada','en_negociacion'))  AS cotizaciones_abiertas,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.cotizaciones x
     WHERE x.cliente_id = c.id AND x.estado IN ('enviada','en_negociacion'))  AS pipeline_abierto_ars,
  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE x.estado = 'aceptada')
          / NULLIF(COUNT(*) FILTER (WHERE x.estado IN ('aceptada','rechazada','vencida')), 0), 1)
     FROM gannet_demo.cotizaciones x WHERE x.cliente_id = c.id)               AS tasa_conversion_pct,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.cliente_id = c.id AND x.estado <> 'anulada')                     AS facturado_total_ars,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.cliente_id = c.id AND x.estado <> 'anulada'
       AND x.fecha_emision >= date_trunc('year', CURRENT_DATE)::date)         AS facturado_ytd_ars,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.cliente_id = c.id AND x.estado IN ('emitida','enviada','vencida')) AS saldo_pendiente_ars,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.cliente_id = c.id AND x.estado = 'vencida')                      AS saldo_vencido_ars,
  (SELECT MAX(x.fecha_emision) FROM gannet_demo.facturas x
     WHERE x.cliente_id = c.id AND x.estado <> 'anulada')                     AS ultima_factura_el,
  (SELECT COUNT(*) FROM gannet_demo.documentos x
     WHERE x.cliente_id = c.id)                                               AS documentos_total,
  (SELECT MAX(x.fecha) FROM gannet_demo.actividades x
     WHERE x.cliente_id = c.id AND x.fecha <= now())                          AS ultima_actividad_en,
  (SELECT x.titulo FROM gannet_demo.actividades x
     WHERE x.cliente_id = c.id AND x.fecha <= now()
     ORDER BY x.fecha DESC LIMIT 1)                                           AS ultima_actividad
FROM gannet_demo.clientes c
LEFT JOIN gannet_demo.empleados e ON e.id = c.ejecutivo_cuenta_id
LEFT JOIN gannet_demo.contactos cp
       ON cp.cliente_id = c.id AND cp.es_principal
ORDER BY c.id;

COMMENT ON VIEW public.gd_cliente_detalle IS
  'Vista 360 de cada cliente para el panel de detalle: datos de identificacion y comerciales, ejecutivo de cuenta, contacto principal, faenas, proyectos y monto contratado, ordenes de trabajo y horas ejecutadas, embudo de cotizaciones con tasa de conversion, facturacion y saldos, documentos y ultima actividad. Se filtra por cliente_id, nunca por nombre.';

-- -----------------------------------------------------------------------------
-- 6. gd_pipeline_cotizaciones — embudo comercial
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_pipeline_cotizaciones AS
SELECT
  co.estado,
  CASE co.estado
    WHEN 'borrador'       THEN 1
    WHEN 'enviada'        THEN 2
    WHEN 'en_negociacion' THEN 3
    WHEN 'aceptada'       THEN 4
    WHEN 'rechazada'      THEN 5
    WHEN 'vencida'        THEN 6
  END                                                            AS orden_embudo,
  CASE co.estado
    WHEN 'borrador'       THEN 'En elaboracion'
    WHEN 'enviada'        THEN 'Enviada al cliente'
    WHEN 'en_negociacion' THEN 'En negociacion'
    WHEN 'aceptada'       THEN 'Aceptada'
    WHEN 'rechazada'      THEN 'Rechazada'
    WHEN 'vencida'        THEN 'Vencida'
  END                                                            AS etiqueta,
  (co.estado IN ('borrador','enviada','en_negociacion'))         AS es_pipeline_abierto,
  COUNT(*)                                                       AS cantidad,
  COALESCE(SUM(co.total_ars), 0)                                 AS monto_nominal_ars,
  COALESCE(SUM(co.total_ars * co.probabilidad_pct / 100.0), 0)::numeric(14,2) AS monto_ponderado_ars,
  ROUND(AVG(co.probabilidad_pct), 1)                             AS probabilidad_promedio_pct,
  ROUND(AVG(co.total_ars), 2)                                    AS ticket_promedio_ars,
  COUNT(DISTINCT co.cliente_id)                                  AS clientes_alcanzados,
  MIN(co.fecha_emision)                                          AS primera_emision,
  MAX(co.fecha_emision)                                          AS ultima_emision,
  COUNT(*) FILTER (WHERE co.fecha_validez < CURRENT_DATE)        AS fuera_de_validez
FROM gannet_demo.cotizaciones co
GROUP BY co.estado
ORDER BY orden_embudo;

COMMENT ON VIEW public.gd_pipeline_cotizaciones IS
  'Embudo comercial agrupado por estado de la cotizacion, con cantidad, monto nominal, monto ponderado por la probabilidad de cierre declarada, probabilidad promedio, ticket promedio, clientes alcanzados y cotizaciones fuera de su fecha de validez. El campo orden_embudo permite dibujar el funnel en el orden correcto.';

-- -----------------------------------------------------------------------------
-- 7. gd_proyectos_estado — avance, desvio economico y atraso
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_proyectos_estado AS
SELECT
  p.id                                          AS proyecto_id,
  p.codigo                                      AS proyecto_codigo,
  p.nombre                                      AS proyecto,
  p.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  p.faena_id,
  fa.nombre                                     AS faena,
  p.servicio_id,
  se.nombre                                     AS servicio,
  p.responsable_id,
  (em.nombre || ' ' || em.apellido)             AS responsable,
  p.tipo_contrato,
  p.estado,
  p.fecha_inicio_plan,
  p.fecha_fin_plan,
  p.fecha_inicio_real,
  p.fecha_fin_real,
  p.avance_pct,
  p.monto_contrato_ars,
  p.monto_ejecutado_ars,
  COALESCE(p.monto_contrato_ars, 0) - COALESCE(p.monto_ejecutado_ars, 0) AS saldo_contrato_ars,
  ROUND(100.0 * COALESCE(p.monto_ejecutado_ars, 0)
        / NULLIF(p.monto_contrato_ars, 0), 1)   AS avance_economico_pct,
  -- Desvio presupuestario: cuanto se gasto de mas respecto de lo que el avance
  -- fisico justificaria. Positivo indica sobreejecucion.
  ROUND(100.0 * COALESCE(p.monto_ejecutado_ars, 0)
        / NULLIF(p.monto_contrato_ars, 0), 1) - p.avance_pct AS desvio_presupuestario_pp,
  (COALESCE(p.monto_ejecutado_ars, 0)
    - COALESCE(p.monto_contrato_ars, 0) * p.avance_pct / 100.0)::numeric(14,2) AS desvio_presupuestario_ars,
  -- Dias de atraso contra el plan: si el proyecto cerro, contra la fecha real;
  -- si sigue abierto y ya paso el plan, contra la fecha de hoy.
  CASE
    WHEN p.fecha_fin_plan IS NULL THEN NULL
    WHEN p.fecha_fin_real IS NOT NULL THEN GREATEST(p.fecha_fin_real - p.fecha_fin_plan, 0)
    WHEN p.estado IN ('en_curso','planificado','suspendido')
      THEN GREATEST(CURRENT_DATE - p.fecha_fin_plan, 0)
    ELSE 0
  END                                           AS dias_atraso,
  (p.fecha_fin_plan IS NOT NULL
   AND p.fecha_fin_real IS NULL
   AND p.estado IN ('en_curso','planificado','suspendido')
   AND p.fecha_fin_plan < CURRENT_DATE)         AS esta_vencido,
  (p.fecha_fin_plan - CURRENT_DATE)             AS dias_para_fin_plan,
  p.margen_objetivo_pct,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x WHERE x.proyecto_id = p.id) AS ot_total,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.proyecto_id = p.id
       AND x.estado IN ('programada','en_ejecucion','pausada'))                   AS ot_abiertas,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.proyecto_id = p.id AND x.estado <> 'anulada')                        AS facturado_ars
FROM gannet_demo.proyectos p
LEFT JOIN gannet_demo.clientes  cl ON cl.id = p.cliente_id
LEFT JOIN gannet_demo.faenas    fa ON fa.id = p.faena_id
LEFT JOIN gannet_demo.servicios se ON se.id = p.servicio_id
LEFT JOIN gannet_demo.empleados em ON em.id = p.responsable_id
ORDER BY
  CASE p.estado WHEN 'en_curso' THEN 1 WHEN 'planificado' THEN 2
                WHEN 'suspendido' THEN 3 WHEN 'finalizado' THEN 4 ELSE 5 END,
  p.fecha_fin_plan NULLS LAST;

COMMENT ON VIEW public.gd_proyectos_estado IS
  'Cartera de proyectos con cliente, faena, servicio y responsable resueltos por nombre, avance fisico y economico, desvio presupuestario expresado en puntos porcentuales y en pesos, dias de atraso contra el plan, ordenes de trabajo asociadas y monto facturado. El desvio positivo indica que se ejecuto mas dinero del que justifica el avance fisico declarado.';

-- -----------------------------------------------------------------------------
-- 8. gd_margen_por_proyecto — contrato contra costo real
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_margen_por_proyecto AS
WITH costos_ot AS (
  SELECT proyecto_id,
         COALESCE(SUM(costo_mano_obra_ars), 0)  AS mano_obra_ars,
         COALESCE(SUM(costo_materiales_ars), 0) AS materiales_ars,
         COALESCE(SUM(monto_facturable_ars), 0) AS facturable_ot_ars,
         COALESCE(SUM(horas_reales), 0)         AS horas_reales,
         COUNT(*)                               AS ot_total
  FROM gannet_demo.ordenes_trabajo
  WHERE proyecto_id IS NOT NULL AND estado <> 'cancelada'
  GROUP BY 1
),
compras AS (
  SELECT proyecto_id,
         COALESCE(SUM(total_ars), 0) AS compras_ars,
         COUNT(*)                    AS oc_total
  FROM gannet_demo.ordenes_compra
  WHERE proyecto_id IS NOT NULL AND estado <> 'cancelada'
  GROUP BY 1
),
base AS (
  SELECT
    p.id, p.codigo, p.nombre, p.estado, p.avance_pct,
    p.cliente_id, p.servicio_id, p.responsable_id,
    p.monto_contrato_ars, p.monto_ejecutado_ars, p.margen_objetivo_pct,
    COALESCE(co.mano_obra_ars, 0)   AS mano_obra_ars,
    COALESCE(co.materiales_ars, 0)  AS materiales_ars,
    COALESCE(cp.compras_ars, 0)     AS compras_ars,
    COALESCE(co.horas_reales, 0)    AS horas_reales,
    COALESCE(co.ot_total, 0)        AS ot_total,
    COALESCE(cp.oc_total, 0)        AS oc_total,
    COALESCE(co.mano_obra_ars, 0)
      + COALESCE(co.materiales_ars, 0)
      + COALESCE(cp.compras_ars, 0) AS costo_total_ars
  FROM gannet_demo.proyectos p
  LEFT JOIN costos_ot co ON co.proyecto_id = p.id
  LEFT JOIN compras   cp ON cp.proyecto_id = p.id
)
SELECT
  b.id                                          AS proyecto_id,
  b.codigo                                      AS proyecto_codigo,
  b.nombre                                      AS proyecto,
  b.estado,
  b.avance_pct,
  b.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  b.servicio_id,
  se.nombre                                     AS servicio,
  b.responsable_id,
  (em.nombre || ' ' || em.apellido)             AS responsable,
  b.monto_contrato_ars,
  b.monto_ejecutado_ars,
  b.mano_obra_ars                               AS costo_mano_obra_ars,
  b.materiales_ars                              AS costo_materiales_ars,
  b.compras_ars                                 AS costo_compras_ars,
  b.costo_total_ars,
  b.horas_reales,
  b.ot_total,
  b.oc_total,
  (COALESCE(b.monto_contrato_ars, 0) - b.costo_total_ars)::numeric(14,2) AS margen_real_ars,
  ROUND(100.0 * (COALESCE(b.monto_contrato_ars, 0) - b.costo_total_ars)
        / NULLIF(b.monto_contrato_ars, 0), 2)   AS margen_real_pct,
  b.margen_objetivo_pct,
  ROUND(100.0 * (COALESCE(b.monto_contrato_ars, 0) - b.costo_total_ars)
        / NULLIF(b.monto_contrato_ars, 0), 2) - b.margen_objetivo_pct AS brecha_margen_pp,
  (ROUND(100.0 * (COALESCE(b.monto_contrato_ars, 0) - b.costo_total_ars)
         / NULLIF(b.monto_contrato_ars, 0), 2) < b.margen_objetivo_pct) AS bajo_objetivo
FROM base b
LEFT JOIN gannet_demo.clientes  cl ON cl.id = b.cliente_id
LEFT JOIN gannet_demo.servicios se ON se.id = b.servicio_id
LEFT JOIN gannet_demo.empleados em ON em.id = b.responsable_id
ORDER BY b.monto_contrato_ars DESC NULLS LAST;

COMMENT ON VIEW public.gd_margen_por_proyecto IS
  'Rentabilidad real de cada proyecto: monto contratado contra la suma de los costos efectivamente incurridos, desagregados en mano de obra y materiales de las ordenes de trabajo mas las ordenes de compra imputadas al proyecto. Devuelve el margen real en pesos y en porcentaje, el margen objetivo fijado al cotizar y la brecha entre ambos en puntos porcentuales. La bandera bajo_objetivo marca los proyectos que no alcanzan su rentabilidad prevista.';

-- -----------------------------------------------------------------------------
-- 9. gd_ot_operativas — grilla plana de ordenes de trabajo
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_ot_operativas AS
SELECT
  ot.id                                         AS ot_id,
  ot.numero                                     AS ot_numero,
  ot.titulo,
  ot.descripcion,
  ot.tipo,
  ot.prioridad,
  ot.estado,
  (ot.estado IN ('programada','en_ejecucion','pausada')) AS esta_abierta,
  ot.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  ot.proyecto_id,
  pr.codigo                                     AS proyecto_codigo,
  pr.nombre                                     AS proyecto,
  ot.faena_id,
  fa.nombre                                     AS faena,
  fa.tipo                                       AS faena_tipo,
  fa.provincia                                  AS faena_provincia,
  ot.servicio_id,
  se.nombre                                     AS servicio,
  se.color_hex                                  AS servicio_color_hex,
  ot.responsable_id,
  (em.nombre || ' ' || em.apellido)             AS responsable,
  em.area                                       AS responsable_area,
  ot.vehiculo_id,
  ve.dominio                                    AS vehiculo_dominio,
  (ve.tipo || ' ' || COALESCE(ve.marca, '') || ' ' || COALESCE(ve.modelo, '')) AS vehiculo,
  ot.equipo_id,
  eq.codigo_interno                             AS equipo_codigo,
  eq.nombre                                     AS equipo,
  ot.fecha_programada,
  ot.fecha_inicio,
  ot.fecha_fin,
  ot.horas_estimadas,
  ot.horas_reales,
  (COALESCE(ot.horas_reales, 0) - COALESCE(ot.horas_estimadas, 0))::numeric(8,2) AS desvio_horas,
  ot.costo_mano_obra_ars,
  ot.costo_materiales_ars,
  (COALESCE(ot.costo_mano_obra_ars, 0) + COALESCE(ot.costo_materiales_ars, 0))::numeric(14,2) AS costo_total_ars,
  ot.monto_facturable_ars,
  (COALESCE(ot.monto_facturable_ars, 0)
    - COALESCE(ot.costo_mano_obra_ars, 0)
    - COALESCE(ot.costo_materiales_ars, 0))::numeric(14,2) AS margen_ars,
  ot.requiere_permiso,
  ot.incidentes_seguridad,
  (SELECT COUNT(*) FROM gannet_demo.ot_asignaciones oa
     WHERE oa.orden_trabajo_id = ot.id)         AS dotacion_asignada,
  CASE
    WHEN ot.fecha_programada IS NULL THEN NULL
    WHEN ot.estado IN ('programada','pausada','en_ejecucion')
      THEN (ot.fecha_programada - CURRENT_DATE)
    ELSE NULL
  END                                           AS dias_para_fecha_programada,
  (ot.estado IN ('programada','pausada')
   AND ot.fecha_programada < CURRENT_DATE)      AS esta_atrasada,
  ot.creado_en
FROM gannet_demo.ordenes_trabajo ot
LEFT JOIN gannet_demo.clientes  cl ON cl.id = ot.cliente_id
LEFT JOIN gannet_demo.proyectos pr ON pr.id = ot.proyecto_id
LEFT JOIN gannet_demo.faenas    fa ON fa.id = ot.faena_id
LEFT JOIN gannet_demo.servicios se ON se.id = ot.servicio_id
LEFT JOIN gannet_demo.empleados em ON em.id = ot.responsable_id
LEFT JOIN gannet_demo.vehiculos ve ON ve.id = ot.vehiculo_id
LEFT JOIN gannet_demo.equipos   eq ON eq.id = ot.equipo_id
ORDER BY ot.fecha_programada DESC NULLS LAST, ot.id DESC;

COMMENT ON VIEW public.gd_ot_operativas IS
  'Grilla plana de todas las ordenes de trabajo con cliente, proyecto, faena, servicio, responsable, vehiculo y equipo resueltos por nombre, junto con sus identificadores para el drill-down. Agrega desvio de horas, costo total, margen, dotacion asignada, dias hasta la fecha programada y la marca de atraso. Es la tabla central del modulo operativo.';

-- -----------------------------------------------------------------------------
-- 10. gd_ot_carga_operativa — carga por estado y prioridad
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_ot_carga_operativa AS
SELECT
  ot.estado,
  ot.prioridad,
  CASE ot.estado
    WHEN 'borrador'     THEN 1
    WHEN 'programada'   THEN 2
    WHEN 'en_ejecucion' THEN 3
    WHEN 'pausada'      THEN 4
    WHEN 'completada'   THEN 5
    WHEN 'cancelada'    THEN 6
  END                                               AS orden_estado,
  CASE ot.prioridad
    WHEN 'critica' THEN 1
    WHEN 'alta'    THEN 2
    WHEN 'media'   THEN 3
    WHEN 'baja'    THEN 4
  END                                               AS orden_prioridad,
  (ot.estado IN ('programada','en_ejecucion','pausada')) AS esta_abierta,
  COUNT(*)                                          AS cantidad,
  COALESCE(SUM(ot.horas_estimadas), 0)              AS horas_estimadas,
  COALESCE(SUM(ot.horas_reales), 0)                 AS horas_reales,
  COALESCE(SUM(ot.monto_facturable_ars), 0)         AS monto_facturable_ars,
  COALESCE(SUM(ot.costo_mano_obra_ars + ot.costo_materiales_ars), 0) AS costo_total_ars,
  COUNT(DISTINCT ot.cliente_id)                     AS clientes,
  COUNT(DISTINCT ot.responsable_id)                 AS responsables,
  COALESCE(SUM(ot.incidentes_seguridad), 0)         AS incidentes_seguridad,
  COUNT(*) FILTER (WHERE ot.fecha_programada < CURRENT_DATE
                     AND ot.estado IN ('programada','pausada')) AS atrasadas
FROM gannet_demo.ordenes_trabajo ot
GROUP BY ot.estado, ot.prioridad
ORDER BY orden_estado, orden_prioridad;

COMMENT ON VIEW public.gd_ot_carga_operativa IS
  'Ordenes de trabajo agrupadas por estado y prioridad, con cantidad, horas estimadas y reales, monto facturable, costo total, clientes y responsables involucrados, incidentes de seguridad y ordenes atrasadas. Alimenta el mapa de calor de carga operativa del panel.';

-- -----------------------------------------------------------------------------
-- 11. gd_ot_cumplimiento — desvio de horas y cumplimiento de fecha
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_ot_cumplimiento AS
WITH cerradas AS (
  SELECT
    ot.servicio_id,
    ot.responsable_id,
    ot.horas_estimadas,
    ot.horas_reales,
    (COALESCE(ot.horas_reales, 0) - COALESCE(ot.horas_estimadas, 0)) AS desvio_horas,
    (ot.fecha_programada IS NOT NULL
     AND ot.fecha_fin IS NOT NULL
     AND ot.fecha_fin::date <= ot.fecha_programada)                  AS en_fecha,
    ot.incidentes_seguridad,
    ot.monto_facturable_ars
  FROM gannet_demo.ordenes_trabajo ot
  WHERE ot.estado = 'completada'
)
SELECT
  'servicio'::text                                  AS dimension,
  se.id                                             AS dimension_id,
  se.nombre                                         AS dimension_nombre,
  NULL::text                                        AS dimension_detalle,
  COUNT(*)                                          AS ot_completadas,
  COALESCE(SUM(c.horas_estimadas), 0)               AS horas_estimadas,
  COALESCE(SUM(c.horas_reales), 0)                  AS horas_reales,
  COALESCE(SUM(c.desvio_horas), 0)                  AS desvio_horas_total,
  ROUND(AVG(c.desvio_horas), 2)                     AS desvio_horas_promedio,
  ROUND(100.0 * COALESCE(SUM(c.horas_reales), 0)
        / NULLIF(SUM(c.horas_estimadas), 0), 1)     AS horas_reales_sobre_estimadas_pct,
  COUNT(*) FILTER (WHERE c.en_fecha)                AS entregas_en_fecha,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.en_fecha) / NULLIF(COUNT(*), 0), 1) AS cumplimiento_fecha_pct,
  COALESCE(SUM(c.incidentes_seguridad), 0)          AS incidentes_seguridad,
  COALESCE(SUM(c.monto_facturable_ars), 0)          AS monto_facturable_ars
FROM cerradas c
JOIN gannet_demo.servicios se ON se.id = c.servicio_id
GROUP BY se.id, se.nombre

UNION ALL

SELECT
  'responsable'::text                               AS dimension,
  em.id                                             AS dimension_id,
  (em.nombre || ' ' || em.apellido)                 AS dimension_nombre,
  em.area                                           AS dimension_detalle,
  COUNT(*)                                          AS ot_completadas,
  COALESCE(SUM(c.horas_estimadas), 0)               AS horas_estimadas,
  COALESCE(SUM(c.horas_reales), 0)                  AS horas_reales,
  COALESCE(SUM(c.desvio_horas), 0)                  AS desvio_horas_total,
  ROUND(AVG(c.desvio_horas), 2)                     AS desvio_horas_promedio,
  ROUND(100.0 * COALESCE(SUM(c.horas_reales), 0)
        / NULLIF(SUM(c.horas_estimadas), 0), 1)     AS horas_reales_sobre_estimadas_pct,
  COUNT(*) FILTER (WHERE c.en_fecha)                AS entregas_en_fecha,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.en_fecha) / NULLIF(COUNT(*), 0), 1) AS cumplimiento_fecha_pct,
  COALESCE(SUM(c.incidentes_seguridad), 0)          AS incidentes_seguridad,
  COALESCE(SUM(c.monto_facturable_ars), 0)          AS monto_facturable_ars
FROM cerradas c
JOIN gannet_demo.empleados em ON em.id = c.responsable_id
GROUP BY em.id, em.nombre, em.apellido, em.area;

COMMENT ON VIEW public.gd_ot_cumplimiento IS
  'Cumplimiento de las ordenes de trabajo completadas, medido en dos dimensiones dentro de la misma vista: por servicio y por responsable. La columna dimension indica cual de las dos, y dimension_id permite el drill-down a la entidad correspondiente. Devuelve horas estimadas contra reales, desvio total y promedio, porcentaje de entregas dentro de la fecha programada, incidentes de seguridad y monto facturable.';

-- -----------------------------------------------------------------------------
-- 12. gd_cobranzas_aging — antiguedad de la deuda por cliente
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_cobranzas_aging AS
WITH impagas AS (
  SELECT
    f.cliente_id,
    f.total_ars,
    f.fecha_vencimiento,
    GREATEST(CURRENT_DATE - f.fecha_vencimiento, 0) AS dias_vencido,
    CASE
      WHEN f.fecha_vencimiento IS NULL
        OR f.fecha_vencimiento >= CURRENT_DATE            THEN 'corriente'
      WHEN CURRENT_DATE - f.fecha_vencimiento <= 30       THEN '1-30'
      WHEN CURRENT_DATE - f.fecha_vencimiento <= 60       THEN '31-60'
      WHEN CURRENT_DATE - f.fecha_vencimiento <= 90       THEN '61-90'
      ELSE '+90'
    END AS tramo
  FROM gannet_demo.facturas f
  WHERE f.estado IN ('emitida', 'enviada', 'vencida')
)
SELECT
  i.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  cl.estado                                      AS estado_cliente,
  cl.condicion_pago_dias,
  cl.limite_credito_ars,
  i.tramo,
  CASE i.tramo
    WHEN 'corriente' THEN 1
    WHEN '1-30'      THEN 2
    WHEN '31-60'     THEN 3
    WHEN '61-90'     THEN 4
    WHEN '+90'       THEN 5
  END                                            AS orden_tramo,
  CASE i.tramo
    WHEN 'corriente' THEN 'A vencer'
    WHEN '1-30'      THEN 'Vencido 1 a 30 dias'
    WHEN '31-60'     THEN 'Vencido 31 a 60 dias'
    WHEN '61-90'     THEN 'Vencido 61 a 90 dias'
    WHEN '+90'       THEN 'Vencido mas de 90 dias'
  END                                            AS etiqueta_tramo,
  COUNT(*)                                       AS facturas,
  COALESCE(SUM(i.total_ars), 0)                  AS monto_ars,
  ROUND(AVG(i.dias_vencido), 0)                  AS dias_vencido_promedio,
  MAX(i.dias_vencido)                            AS dias_vencido_maximo,
  MIN(i.fecha_vencimiento)                       AS vencimiento_mas_antiguo
FROM impagas i
LEFT JOIN gannet_demo.clientes cl ON cl.id = i.cliente_id
GROUP BY i.cliente_id, cl.nombre_comercial, cl.razon_social, cl.estado,
         cl.condicion_pago_dias, cl.limite_credito_ars, i.tramo
ORDER BY orden_tramo DESC, monto_ars DESC;

COMMENT ON VIEW public.gd_cobranzas_aging IS
  'Antiguedad de la deuda: facturas impagas agrupadas por cliente y por tramo de mora, con los tramos corriente (a vencer), 1 a 30, 31 a 60, 61 a 90 y mas de 90 dias. Devuelve cantidad de comprobantes, monto, dias de mora promedio y maximo y el vencimiento mas antiguo del tramo. Incluye cliente_id para navegar al detalle del cliente.';

-- -----------------------------------------------------------------------------
-- 13. gd_flota_estado — situacion de cada vehiculo
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_flota_estado AS
SELECT
  v.id                                          AS vehiculo_id,
  v.dominio,
  v.tipo,
  v.marca,
  v.modelo,
  v.anio,
  (CASE WHEN v.anio IS NULL THEN NULL
        ELSE EXTRACT(YEAR FROM CURRENT_DATE)::int - v.anio END) AS antiguedad_anios,
  v.estado,
  (v.estado = 'operativo')                      AS esta_operativo,
  v.km_actual,
  v.costo_km_ars,
  v.valor_ars,
  v.responsable_id,
  (em.nombre || ' ' || em.apellido)             AS responsable,
  em.area                                       AS responsable_area,
  v.deposito_base_id,
  de.nombre                                     AS deposito_base,
  v.vtv_vence_el,
  (v.vtv_vence_el - CURRENT_DATE)               AS dias_para_vtv,
  (v.vtv_vence_el IS NOT NULL AND v.vtv_vence_el < CURRENT_DATE) AS vtv_vencida,
  (v.vtv_vence_el IS NOT NULL
   AND v.vtv_vence_el BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS vtv_por_vencer_30d,
  v.seguro_vence_el,
  (v.seguro_vence_el - CURRENT_DATE)            AS dias_para_seguro,
  (v.seguro_vence_el IS NOT NULL AND v.seguro_vence_el < CURRENT_DATE) AS seguro_vencido,
  (v.seguro_vence_el IS NOT NULL
   AND v.seguro_vence_el BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS seguro_por_vencer_30d,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo ot
     WHERE ot.vehiculo_id = v.id
       AND ot.estado IN ('programada','en_ejecucion','pausada'))  AS ot_en_curso,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo ot
     WHERE ot.vehiculo_id = v.id)                                 AS ot_historicas,
  (SELECT COUNT(*) FROM gannet_demo.mantenimientos ma
     WHERE ma.vehiculo_id = v.id AND ma.estado IN ('programado','en_taller')) AS mantenimientos_pendientes,
  (SELECT MAX(ma.fecha) FROM gannet_demo.mantenimientos ma
     WHERE ma.vehiculo_id = v.id AND ma.estado = 'completado')    AS ultimo_mantenimiento_el,
  (SELECT COALESCE(SUM(ma.costo_ars), 0) FROM gannet_demo.mantenimientos ma
     WHERE ma.vehiculo_id = v.id AND ma.estado = 'completado')    AS costo_mantenimiento_ars,
  (SELECT COUNT(*) FROM gannet_demo.documentos dc
     WHERE dc.vehiculo_id = v.id)                                 AS documentos
FROM gannet_demo.vehiculos v
LEFT JOIN gannet_demo.empleados em ON em.id = v.responsable_id
LEFT JOIN gannet_demo.depositos de ON de.id = v.deposito_base_id
ORDER BY
  CASE v.estado WHEN 'operativo' THEN 1 WHEN 'en_mantenimiento' THEN 2
                WHEN 'fuera_servicio' THEN 3 ELSE 4 END,
  v.dominio;

COMMENT ON VIEW public.gd_flota_estado IS
  'Situacion de cada vehiculo de la flota propia: estado, kilometraje, antiguedad, valor, responsable y deposito base resueltos por nombre, vencimientos de verificacion tecnica y de poliza de seguro con sus dias restantes y banderas de vencido o por vencer en treinta dias, ordenes de trabajo en curso asignadas, mantenimientos pendientes y costo de mantenimiento acumulado.';

-- -----------------------------------------------------------------------------
-- 14. gd_equipos_disponibilidad — parque de equipos por categoria y estado
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_equipos_disponibilidad AS
SELECT
  eq.categoria,
  eq.estado,
  (eq.estado = 'disponible')                     AS esta_disponible,
  COUNT(*)                                       AS cantidad,
  COUNT(*) FILTER (WHERE eq.es_alquilable)       AS alquilables,
  COALESCE(SUM(eq.valor_ars), 0)                 AS valor_total_ars,
  ROUND(AVG(eq.tarifa_dia_ars), 2)               AS tarifa_dia_promedio_ars,
  COUNT(*) FILTER (WHERE eq.proxima_calibracion IS NOT NULL
                     AND eq.proxima_calibracion < CURRENT_DATE)   AS calibraciones_vencidas,
  COUNT(*) FILTER (WHERE eq.proxima_calibracion
                     BETWEEN CURRENT_DATE AND CURRENT_DATE + 30)  AS calibraciones_por_vencer_30d,
  MIN(eq.proxima_calibracion)                    AS calibracion_mas_proxima,
  COUNT(DISTINCT eq.deposito_id)                 AS depositos,
  COUNT(DISTINCT eq.servicio_id)                 AS servicios,
  string_agg(DISTINCT se.nombre, ', ' ORDER BY se.nombre) AS servicios_asociados
FROM gannet_demo.equipos eq
LEFT JOIN gannet_demo.servicios se ON se.id = eq.servicio_id
GROUP BY eq.categoria, eq.estado
ORDER BY eq.categoria, eq.estado;

COMMENT ON VIEW public.gd_equipos_disponibilidad IS
  'Parque de equipos, maquinaria e instrumental agrupado por categoria y estado, con cantidad, equipos alquilables, valor patrimonial, tarifa diaria promedio, calibraciones ya vencidas, calibraciones que vencen dentro de los proximos treinta dias, la fecha de calibracion mas proxima y los servicios a los que el grupo esta afectado.';

-- -----------------------------------------------------------------------------
-- 15. gd_stock_critico — articulos bajo su punto de reposicion
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_stock_critico AS
SELECT
  st.id                                          AS stock_id,
  st.articulo_id,
  ar.codigo                                      AS articulo_codigo,
  ar.descripcion                                 AS articulo,
  ar.categoria                                   AS articulo_categoria,
  ar.unidad_medida,
  st.deposito_id,
  de.nombre                                      AS deposito,
  de.tipo                                        AS deposito_tipo,
  de.responsable_id                              AS deposito_responsable_id,
  (em.nombre || ' ' || em.apellido)              AS deposito_responsable,
  st.cantidad                                    AS cantidad_actual,
  ar.stock_minimo,
  (ar.stock_minimo - st.cantidad)::numeric(14,2) AS faltante,
  ROUND(100.0 * st.cantidad / NULLIF(ar.stock_minimo, 0), 1) AS cobertura_pct,
  ar.costo_unitario_ars,
  ((ar.stock_minimo - st.cantidad) * COALESCE(ar.costo_unitario_ars, 0))::numeric(14,2)
                                                 AS costo_reposicion_ars,
  (st.cantidad <= 0)                             AS sin_existencia,
  st.actualizado_en,
  (SELECT MAX(mv.fecha) FROM gannet_demo.movimientos_stock mv
     WHERE mv.articulo_id = st.articulo_id AND mv.deposito_id = st.deposito_id) AS ultimo_movimiento_en,
  (SELECT COUNT(*) FROM gannet_demo.orden_compra_items oi
     JOIN gannet_demo.ordenes_compra oc ON oc.id = oi.orden_compra_id
    WHERE oi.articulo_id = st.articulo_id
      AND oc.estado IN ('aprobada','enviada','recibida_parcial'))               AS compras_en_curso
FROM gannet_demo.stock st
JOIN gannet_demo.articulos ar ON ar.id = st.articulo_id
JOIN gannet_demo.depositos de ON de.id = st.deposito_id
LEFT JOIN gannet_demo.empleados em ON em.id = de.responsable_id
WHERE ar.activo
  AND ar.stock_minimo IS NOT NULL
  AND st.cantidad < ar.stock_minimo
ORDER BY (ar.stock_minimo - st.cantidad) * COALESCE(ar.costo_unitario_ars, 0) DESC;

COMMENT ON VIEW public.gd_stock_critico IS
  'Articulos cuya existencia en un deposito cayo por debajo de su stock minimo. Devuelve el articulo y el deposito resueltos por nombre con sus identificadores, la cantidad actual, el faltante, el porcentaje de cobertura sobre el minimo, el costo estimado de reposicion, la fecha del ultimo movimiento y si hay ordenes de compra en curso que cubran el faltante.';

-- -----------------------------------------------------------------------------
-- 16. gd_compras_por_proveedor — desempeno del abastecimiento
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_compras_por_proveedor AS
SELECT
  pv.id                                          AS proveedor_id,
  pv.razon_social                                AS proveedor,
  pv.cuit,
  pv.rubro,
  pv.contacto,
  pv.email,
  pv.telefono,
  pv.calificacion,
  pv.condicion_pago_dias,
  pv.activo,
  COUNT(oc.id)                                   AS oc_total,
  COUNT(oc.id) FILTER (WHERE oc.estado IN ('aprobada','enviada','recibida_parcial')) AS oc_en_curso,
  COUNT(oc.id) FILTER (WHERE oc.estado = 'recibida')     AS oc_recibidas,
  COUNT(oc.id) FILTER (WHERE oc.estado = 'cancelada')    AS oc_canceladas,
  COALESCE(SUM(oc.total_ars) FILTER (WHERE oc.estado <> 'cancelada'), 0) AS monto_total_ars,
  COALESCE(SUM(oc.total_ars) FILTER (
    WHERE oc.estado <> 'cancelada'
      AND oc.fecha_emision >= date_trunc('year', CURRENT_DATE)::date), 0) AS monto_ytd_ars,
  ROUND(AVG(oc.total_ars) FILTER (WHERE oc.estado <> 'cancelada'), 2)     AS ticket_promedio_ars,
  COUNT(oc.id) FILTER (WHERE oc.fecha_recepcion IS NOT NULL
                         AND oc.fecha_entrega_estimada IS NOT NULL
                         AND oc.fecha_recepcion <= oc.fecha_entrega_estimada) AS entregas_en_plazo,
  COUNT(oc.id) FILTER (WHERE oc.fecha_recepcion IS NOT NULL
                         AND oc.fecha_entrega_estimada IS NOT NULL)           AS entregas_evaluables,
  ROUND(100.0 * COUNT(oc.id) FILTER (
          WHERE oc.fecha_recepcion IS NOT NULL
            AND oc.fecha_entrega_estimada IS NOT NULL
            AND oc.fecha_recepcion <= oc.fecha_entrega_estimada)
        / NULLIF(COUNT(oc.id) FILTER (
          WHERE oc.fecha_recepcion IS NOT NULL
            AND oc.fecha_entrega_estimada IS NOT NULL), 0), 1)               AS cumplimiento_plazo_pct,
  ROUND(AVG(oc.fecha_recepcion - oc.fecha_entrega_estimada) FILTER (
          WHERE oc.fecha_recepcion IS NOT NULL
            AND oc.fecha_entrega_estimada IS NOT NULL), 1)                   AS dias_desvio_promedio,
  MAX(oc.fecha_emision)                          AS ultima_compra_el,
  (SELECT COUNT(*) FROM gannet_demo.mantenimientos ma
     WHERE ma.proveedor_id = pv.id)              AS mantenimientos_ejecutados
FROM gannet_demo.proveedores pv
LEFT JOIN gannet_demo.ordenes_compra oc ON oc.proveedor_id = pv.id
GROUP BY pv.id, pv.razon_social, pv.cuit, pv.rubro, pv.contacto, pv.email,
         pv.telefono, pv.calificacion, pv.condicion_pago_dias, pv.activo
ORDER BY COALESCE(SUM(oc.total_ars) FILTER (WHERE oc.estado <> 'cancelada'), 0) DESC;

COMMENT ON VIEW public.gd_compras_por_proveedor IS
  'Desempeno de cada proveedor de Andes: cantidad de ordenes de compra por estado, monto total y del ano en curso, ticket promedio, porcentaje de entregas dentro del plazo comprometido, desvio promedio en dias entre la entrega estimada y la recepcion real, fecha de la ultima compra y mantenimientos que ejecuto. Es la base de la evaluacion de abastecimiento.';

-- -----------------------------------------------------------------------------
-- 17. gd_rrhh_resumen — dotacion, horas, ausentismo y accidentes por area
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_rrhh_resumen AS
WITH turnos_mes AS (
  SELECT
    em.area,
    COUNT(*)                                                   AS turnos_registrados,
    COALESCE(SUM(tu.horas), 0)                                 AS horas_mes,
    COUNT(*) FILTER (WHERE tu.estado = 'presente')             AS turnos_presente,
    COUNT(*) FILTER (WHERE tu.estado = 'ausente')              AS turnos_ausente,
    COUNT(*) FILTER (WHERE tu.estado = 'licencia')             AS turnos_licencia,
    COUNT(*) FILTER (WHERE tu.estado = 'franco')               AS turnos_franco,
    COUNT(*) FILTER (WHERE tu.estado = 'accidente')            AS turnos_accidente
  FROM gannet_demo.turnos tu
  JOIN gannet_demo.empleados em ON em.id = tu.empleado_id
  WHERE tu.fecha >= date_trunc('month', CURRENT_DATE)::date
    AND tu.fecha <= CURRENT_DATE
  GROUP BY em.area
),
plantel AS (
  SELECT
    area,
    COUNT(*)                                                   AS dotacion_total,
    COUNT(*) FILTER (WHERE estado = 'activo')                  AS dotacion_activa,
    COUNT(*) FILTER (WHERE estado = 'licencia')                AS en_licencia,
    COUNT(*) FILTER (WHERE estado = 'suspendido')              AS suspendidos,
    COUNT(*) FILTER (WHERE estado = 'baja')                    AS bajas,
    ROUND(AVG(costo_hora_ars), 2)                              AS costo_hora_promedio_ars,
    ROUND(AVG(CURRENT_DATE - fecha_ingreso) / 365.0, 1)        AS antiguedad_promedio_anios
  FROM gannet_demo.empleados
  GROUP BY area
)
SELECT
  p.area,
  p.dotacion_total,
  p.dotacion_activa,
  p.en_licencia,
  p.suspendidos,
  p.bajas,
  p.costo_hora_promedio_ars,
  p.antiguedad_promedio_anios,
  COALESCE(t.horas_mes, 0)                                     AS horas_mes,
  (COALESCE(t.horas_mes, 0) * COALESCE(p.costo_hora_promedio_ars, 0))::numeric(14,2)
                                                               AS costo_horas_mes_ars,
  COALESCE(t.turnos_registrados, 0)                            AS turnos_mes,
  COALESCE(t.turnos_presente, 0)                               AS turnos_presente,
  COALESCE(t.turnos_ausente, 0)                                AS turnos_ausente,
  COALESCE(t.turnos_licencia, 0)                               AS turnos_licencia,
  COALESCE(t.turnos_franco, 0)                                 AS turnos_franco,
  COALESCE(t.turnos_accidente, 0)                              AS accidentes_mes,
  ROUND(100.0 * COALESCE(t.turnos_ausente, 0)
        / NULLIF(COALESCE(t.turnos_registrados, 0) - COALESCE(t.turnos_franco, 0), 0), 1)
                                                               AS ausentismo_pct,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo ot
     JOIN gannet_demo.empleados e2 ON e2.id = ot.responsable_id
    WHERE e2.area = p.area
      AND ot.estado IN ('programada','en_ejecucion','pausada')) AS ot_abiertas_a_cargo,
  (SELECT COALESCE(SUM(ot.incidentes_seguridad), 0) FROM gannet_demo.ordenes_trabajo ot
     JOIN gannet_demo.empleados e2 ON e2.id = ot.responsable_id
    WHERE e2.area = p.area
      AND ot.fecha_inicio >= date_trunc('year', CURRENT_DATE)) AS incidentes_seguridad_ytd,
  date_trunc('month', CURRENT_DATE)::date                      AS mes_referencia
FROM plantel p
LEFT JOIN turnos_mes t ON t.area = p.area
ORDER BY p.dotacion_activa DESC, p.area;

COMMENT ON VIEW public.gd_rrhh_resumen IS
  'Resumen de recursos humanos por area organizativa: dotacion total y activa, personal en licencia o suspendido, costo hora promedio, antiguedad promedio, horas trabajadas en el mes en curso y su costo estimado, desglose de turnos por condicion, tasa de ausentismo calculada sobre los turnos exigibles (excluye francos), accidentes del mes, ordenes de trabajo abiertas a cargo del area e incidentes de seguridad del ano en curso.';

-- -----------------------------------------------------------------------------
-- 18. gd_documentos_vencimientos — alertas documentales
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_documentos_vencimientos AS
SELECT
  dc.id                                          AS documento_id,
  dc.nombre                                      AS documento,
  dc.tipo                                        AS documento_tipo,
  dc.fecha_emision,
  dc.fecha_vencimiento,
  (dc.fecha_vencimiento - CURRENT_DATE)          AS dias_para_vencer,
  CASE
    WHEN dc.fecha_vencimiento <  CURRENT_DATE                          THEN 'vencido'
    WHEN dc.fecha_vencimiento <= CURRENT_DATE + 30                     THEN '30_dias'
    WHEN dc.fecha_vencimiento <= CURRENT_DATE + 60                     THEN '60_dias'
    ELSE '90_dias'
  END                                            AS tramo,
  CASE
    WHEN dc.fecha_vencimiento <  CURRENT_DATE                          THEN 0
    WHEN dc.fecha_vencimiento <= CURRENT_DATE + 30                     THEN 1
    WHEN dc.fecha_vencimiento <= CURRENT_DATE + 60                     THEN 2
    ELSE 3
  END                                            AS orden_tramo,
  (dc.fecha_vencimiento < CURRENT_DATE)          AS esta_vencido,
  CASE
    WHEN dc.cliente_id       IS NOT NULL THEN 'cliente'
    WHEN dc.proyecto_id      IS NOT NULL THEN 'proyecto'
    WHEN dc.orden_trabajo_id IS NOT NULL THEN 'orden_trabajo'
    WHEN dc.empleado_id      IS NOT NULL THEN 'empleado'
    WHEN dc.vehiculo_id      IS NOT NULL THEN 'vehiculo'
    WHEN dc.equipo_id        IS NOT NULL THEN 'equipo'
  END                                            AS entidad_tipo,
  COALESCE(dc.cliente_id, dc.proyecto_id, dc.orden_trabajo_id,
           dc.empleado_id, dc.vehiculo_id, dc.equipo_id) AS entidad_id,
  COALESCE(
    COALESCE(cl.nombre_comercial, cl.razon_social),
    (pr.codigo || ' — ' || pr.nombre),
    (ot.numero || ' — ' || ot.titulo),
    (em.nombre || ' ' || em.apellido),
    (ve.dominio || ' — ' || ve.tipo),
    (eq.codigo_interno || ' — ' || eq.nombre)
  )                                              AS entidad_nombre,
  dc.cliente_id,
  dc.proyecto_id,
  dc.orden_trabajo_id,
  dc.empleado_id,
  dc.vehiculo_id,
  dc.equipo_id,
  dc.url_archivo,
  dc.tamano_kb
FROM gannet_demo.documentos dc
LEFT JOIN gannet_demo.clientes        cl ON cl.id = dc.cliente_id
LEFT JOIN gannet_demo.proyectos       pr ON pr.id = dc.proyecto_id
LEFT JOIN gannet_demo.ordenes_trabajo ot ON ot.id = dc.orden_trabajo_id
LEFT JOIN gannet_demo.empleados       em ON em.id = dc.empleado_id
LEFT JOIN gannet_demo.vehiculos       ve ON ve.id = dc.vehiculo_id
LEFT JOIN gannet_demo.equipos         eq ON eq.id = dc.equipo_id
WHERE dc.fecha_vencimiento IS NOT NULL
  AND dc.fecha_vencimiento <= CURRENT_DATE + 90
ORDER BY dc.fecha_vencimiento;

COMMENT ON VIEW public.gd_documentos_vencimientos IS
  'Documentos ya vencidos o que vencen dentro de los proximos noventa dias, clasificados en los tramos vencido, treinta, sesenta y noventa dias. Cada fila resuelve por nombre la entidad de la que cuelga el documento (cliente, proyecto, orden de trabajo, empleado, vehiculo o equipo) e informa su tipo y su identificador para el drill-down.';

-- -----------------------------------------------------------------------------
-- 19. gd_actividad_reciente — feed cronologico unificado
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_actividad_reciente AS
WITH bitacora AS (
  SELECT
    'actividad'::text                            AS origen,
    ac.tipo                                      AS evento,
    ac.titulo                                    AS titulo,
    ac.descripcion                               AS detalle,
    ac.fecha                                     AS fecha,
    ac.estado                                    AS estado,
    NULL::numeric(14,2)                          AS monto_ars,
    ac.id                                        AS registro_id,
    CASE
      WHEN ac.orden_trabajo_id IS NOT NULL THEN 'orden_trabajo'
      WHEN ac.cotizacion_id    IS NOT NULL THEN 'cotizacion'
      WHEN ac.proyecto_id      IS NOT NULL THEN 'proyecto'
      ELSE 'cliente'
    END                                          AS entidad_tipo,
    COALESCE(ac.orden_trabajo_id, ac.cotizacion_id, ac.proyecto_id, ac.cliente_id) AS entidad_id,
    ac.cliente_id                                AS cliente_id,
    ac.autor_id                                  AS autor_id
  FROM gannet_demo.actividades ac
  WHERE ac.fecha <= now()
  ORDER BY ac.fecha DESC
  LIMIT 120
),
ordenes AS (
  SELECT
    'orden_trabajo'::text, ot.estado, (ot.numero || ' — ' || ot.titulo),
    ot.descripcion, COALESCE(ot.fecha_fin, ot.fecha_inicio), ot.estado,
    ot.monto_facturable_ars, ot.id, 'orden_trabajo'::text, ot.id,
    ot.cliente_id, ot.responsable_id
  FROM gannet_demo.ordenes_trabajo ot
  WHERE COALESCE(ot.fecha_fin, ot.fecha_inicio) IS NOT NULL
    AND COALESCE(ot.fecha_fin, ot.fecha_inicio) <= now()
  ORDER BY COALESCE(ot.fecha_fin, ot.fecha_inicio) DESC
  LIMIT 60
),
comprobantes AS (
  SELECT
    'factura'::text, fa.estado, ('Factura ' || fa.numero),
    ('Comprobante ' || fa.tipo_comprobante), fa.fecha_emision::timestamptz, fa.estado,
    fa.total_ars, fa.id, 'factura'::text, fa.id,
    fa.cliente_id, NULL::bigint
  FROM gannet_demo.facturas fa
  WHERE fa.fecha_emision IS NOT NULL AND fa.fecha_emision <= CURRENT_DATE
  ORDER BY fa.fecha_emision DESC
  LIMIT 60
),
propuestas AS (
  SELECT
    'cotizacion'::text, co.estado, ('Cotizacion ' || co.numero),
    NULL::text, co.fecha_emision::timestamptz, co.estado,
    co.total_ars, co.id, 'cotizacion'::text, co.id,
    co.cliente_id, co.responsable_comercial_id
  FROM gannet_demo.cotizaciones co
  WHERE co.fecha_emision IS NOT NULL AND co.fecha_emision <= CURRENT_DATE
  ORDER BY co.fecha_emision DESC
  LIMIT 60
),
compras AS (
  SELECT
    'orden_compra'::text, oc.estado, ('Orden de compra ' || oc.numero),
    NULL::text, COALESCE(oc.fecha_recepcion, oc.fecha_emision)::timestamptz, oc.estado,
    oc.total_ars, oc.id, 'orden_compra'::text, oc.id,
    NULL::bigint, oc.solicitante_id
  FROM gannet_demo.ordenes_compra oc
  WHERE COALESCE(oc.fecha_recepcion, oc.fecha_emision) IS NOT NULL
    AND COALESCE(oc.fecha_recepcion, oc.fecha_emision) <= CURRENT_DATE
  ORDER BY COALESCE(oc.fecha_recepcion, oc.fecha_emision) DESC
  LIMIT 40
),
feed AS (
  SELECT * FROM bitacora
  UNION ALL SELECT * FROM ordenes
  UNION ALL SELECT * FROM comprobantes
  UNION ALL SELECT * FROM propuestas
  UNION ALL SELECT * FROM compras
)
SELECT
  f.origen,
  f.evento,
  f.titulo,
  f.detalle,
  f.fecha,
  f.estado,
  f.monto_ars,
  f.registro_id,
  f.entidad_tipo,
  f.entidad_id,
  f.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  f.autor_id,
  (em.nombre || ' ' || em.apellido)              AS autor,
  EXTRACT(EPOCH FROM (now() - f.fecha))::bigint  AS antiguedad_segundos,
  (CURRENT_DATE - f.fecha::date)                 AS antiguedad_dias
FROM feed f
LEFT JOIN gannet_demo.clientes  cl ON cl.id = f.cliente_id
LEFT JOIN gannet_demo.empleados em ON em.id = f.autor_id
ORDER BY f.fecha DESC
LIMIT 200;

COMMENT ON VIEW public.gd_actividad_reciente IS
  'Feed cronologico unificado de los ultimos doscientos hechos del sistema, combinando la bitacora de gestion con el cierre de ordenes de trabajo, la emision de facturas y cotizaciones y el movimiento de ordenes de compra. Cada fila indica su origen, la entidad involucrada resuelta por nombre con su tipo e identificador, el cliente, el autor y la antiguedad del hecho. Es lo que se ve moverse en pantalla durante la demostracion.';

-- -----------------------------------------------------------------------------
-- 20. gd_agenda_proxima — proximos catorce dias
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_agenda_proxima AS
SELECT
  'orden_trabajo'::text                          AS origen,
  ot.id                                          AS registro_id,
  ot.numero                                      AS referencia,
  ot.titulo,
  ot.descripcion                                 AS detalle,
  ot.fecha_programada                            AS fecha,
  (ot.fecha_programada - CURRENT_DATE)           AS dias_restantes,
  (ot.fecha_programada = CURRENT_DATE)           AS es_hoy,
  ot.prioridad,
  ot.estado,
  ot.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  ot.proyecto_id,
  pr.nombre                                      AS proyecto,
  ot.faena_id,
  fa.nombre                                      AS faena,
  ot.servicio_id,
  se.nombre                                      AS servicio,
  ot.responsable_id,
  (em.nombre || ' ' || em.apellido)              AS responsable,
  ot.horas_estimadas,
  ot.monto_facturable_ars                        AS monto_ars
FROM gannet_demo.ordenes_trabajo ot
LEFT JOIN gannet_demo.clientes  cl ON cl.id = ot.cliente_id
LEFT JOIN gannet_demo.proyectos pr ON pr.id = ot.proyecto_id
LEFT JOIN gannet_demo.faenas    fa ON fa.id = ot.faena_id
LEFT JOIN gannet_demo.servicios se ON se.id = ot.servicio_id
LEFT JOIN gannet_demo.empleados em ON em.id = ot.responsable_id
WHERE ot.estado IN ('programada','en_ejecucion','pausada')
  AND ot.fecha_programada BETWEEN CURRENT_DATE AND CURRENT_DATE + 14

UNION ALL

SELECT
  'actividad'::text                              AS origen,
  ac.id                                          AS registro_id,
  ac.tipo                                        AS referencia,
  ac.titulo,
  ac.descripcion                                 AS detalle,
  ac.fecha::date                                 AS fecha,
  (ac.fecha::date - CURRENT_DATE)                AS dias_restantes,
  (ac.fecha::date = CURRENT_DATE)                AS es_hoy,
  NULL::text                                     AS prioridad,
  ac.estado,
  ac.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  ac.proyecto_id,
  pr.nombre                                      AS proyecto,
  NULL::bigint                                   AS faena_id,
  NULL::text                                     AS faena,
  NULL::bigint                                   AS servicio_id,
  NULL::text                                     AS servicio,
  ac.autor_id                                    AS responsable_id,
  (em.nombre || ' ' || em.apellido)              AS responsable,
  NULL::numeric(8,2)                             AS horas_estimadas,
  NULL::numeric(14,2)                            AS monto_ars
FROM gannet_demo.actividades ac
LEFT JOIN gannet_demo.clientes  cl ON cl.id = ac.cliente_id
LEFT JOIN gannet_demo.proyectos pr ON pr.id = ac.proyecto_id
LEFT JOIN gannet_demo.empleados em ON em.id = ac.autor_id
WHERE ac.estado IN ('pendiente','en_curso')
  AND ac.fecha::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 14;

COMMENT ON VIEW public.gd_agenda_proxima IS
  'Agenda de los proximos catorce dias corridos: ordenes de trabajo programadas, en ejecucion o pausadas y actividades de gestion pendientes o en curso, en una sola lista. La columna origen distingue el tipo de compromiso y dias_restantes ordena el horizonte. Todas las claves foraneas vienen resueltas por nombre y acompanadas de su identificador.';

-- =============================================================================
-- BLOQUE 2 — VISTAS DE PASO POR ENTIDAD
-- Sostienen la grilla de cada modulo. Devuelven la tabla base con sus claves
-- foraneas resueltas por nombre y algunos agregados de contexto, conservando
-- siempre los identificadores para el drill-down.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- gd_clientes
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_clientes AS
SELECT
  c.id                                           AS cliente_id,
  COALESCE(c.nombre_comercial, c.razon_social)   AS cliente,
  c.razon_social,
  c.nombre_comercial,
  c.cuit,
  c.mineral_principal,
  c.provincia,
  c.localidad,
  c.estado,
  c.condicion_pago_dias,
  c.limite_credito_ars,
  c.fecha_alta,
  c.sitio_web,
  c.ejecutivo_cuenta_id,
  (e.nombre || ' ' || e.apellido)                AS ejecutivo_cuenta,
  (SELECT COUNT(*) FROM gannet_demo.faenas x    WHERE x.cliente_id = c.id) AS faenas,
  (SELECT COUNT(*) FROM gannet_demo.contactos x WHERE x.cliente_id = c.id AND x.activo) AS contactos,
  (SELECT COUNT(*) FROM gannet_demo.proyectos x WHERE x.cliente_id = c.id AND x.estado = 'en_curso') AS proyectos_activos,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.cliente_id = c.id AND x.estado IN ('programada','en_ejecucion','pausada')) AS ot_abiertas,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.cliente_id = c.id AND x.estado <> 'anulada')                  AS facturado_ars,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.cliente_id = c.id AND x.estado IN ('emitida','enviada','vencida')) AS saldo_pendiente_ars,
  c.creado_en
FROM gannet_demo.clientes c
LEFT JOIN gannet_demo.empleados e ON e.id = c.ejecutivo_cuenta_id
ORDER BY COALESCE(c.nombre_comercial, c.razon_social);

COMMENT ON VIEW public.gd_clientes IS
  'Grilla del modulo de clientes: ficha comercial de cada cliente con su ejecutivo de cuenta resuelto por nombre y los contadores de faenas, contactos, proyectos activos, ordenes de trabajo abiertas, facturado historico y saldo pendiente.';

-- -----------------------------------------------------------------------------
-- gd_contactos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_contactos AS
SELECT
  co.id                                          AS contacto_id,
  (co.nombre || ' ' || co.apellido)              AS contacto,
  co.nombre,
  co.apellido,
  co.cargo,
  co.area,
  co.email,
  co.telefono,
  co.es_principal,
  co.activo,
  co.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  co.faena_id,
  fa.nombre                                      AS faena,
  fa.tipo                                        AS faena_tipo,
  (SELECT COUNT(*) FROM gannet_demo.cotizaciones x WHERE x.contacto_id = co.id) AS cotizaciones,
  (SELECT COUNT(*) FROM gannet_demo.actividades x  WHERE x.contacto_id = co.id) AS actividades,
  (SELECT MAX(x.fecha) FROM gannet_demo.actividades x
     WHERE x.contacto_id = co.id AND x.fecha <= now())                          AS ultima_actividad_en,
  co.creado_en
FROM gannet_demo.contactos co
LEFT JOIN gannet_demo.clientes cl ON cl.id = co.cliente_id
LEFT JOIN gannet_demo.faenas   fa ON fa.id = co.faena_id
ORDER BY cl.razon_social, co.es_principal DESC, co.apellido;

COMMENT ON VIEW public.gd_contactos IS
  'Grilla de contactos del lado del cliente, con el cliente y la faena resueltos por nombre, la marca de contacto principal y los contadores de cotizaciones y actividades en las que participo.';

-- -----------------------------------------------------------------------------
-- gd_empleados
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_empleados AS
SELECT
  em.id                                          AS empleado_id,
  em.legajo,
  (em.nombre || ' ' || em.apellido)              AS empleado,
  em.nombre,
  em.apellido,
  em.documento,
  em.puesto,
  em.area,
  em.modalidad_turno,
  em.estado,
  em.email,
  em.telefono,
  em.fecha_ingreso,
  ROUND((CURRENT_DATE - em.fecha_ingreso) / 365.0, 1) AS antiguedad_anios,
  em.costo_hora_ars,
  em.especialidad_servicio_id,
  se.nombre                                      AS especialidad,
  em.supervisor_id,
  (su.nombre || ' ' || su.apellido)              AS supervisor,
  (SELECT COUNT(*) FROM gannet_demo.empleados x WHERE x.supervisor_id = em.id) AS reportes_directos,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.responsable_id = em.id AND x.estado IN ('programada','en_ejecucion','pausada')) AS ot_abiertas,
  (SELECT COUNT(*) FROM gannet_demo.ot_asignaciones x WHERE x.empleado_id = em.id) AS asignaciones,
  (SELECT COALESCE(SUM(x.horas), 0) FROM gannet_demo.turnos x
     WHERE x.empleado_id = em.id
       AND x.fecha >= date_trunc('month', CURRENT_DATE)::date)                    AS horas_mes,
  (SELECT COUNT(*) FROM gannet_demo.turnos x
     WHERE x.empleado_id = em.id AND x.estado = 'ausente'
       AND x.fecha >= date_trunc('month', CURRENT_DATE)::date)                    AS ausencias_mes,
  em.creado_en
FROM gannet_demo.empleados em
LEFT JOIN gannet_demo.servicios se ON se.id = em.especialidad_servicio_id
LEFT JOIN gannet_demo.empleados su ON su.id = em.supervisor_id
ORDER BY em.apellido, em.nombre;

COMMENT ON VIEW public.gd_empleados IS
  'Grilla de la dotacion propia con especialidad y supervisor resueltos por nombre, antiguedad calculada contra la fecha actual, reportes directos, ordenes de trabajo abiertas a su cargo, asignaciones a cuadrillas, horas trabajadas y ausencias del mes en curso.';

-- -----------------------------------------------------------------------------
-- gd_vehiculos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_vehiculos AS
SELECT
  v.id                                           AS vehiculo_id,
  v.dominio,
  v.tipo,
  v.marca,
  v.modelo,
  v.anio,
  v.estado,
  v.km_actual,
  v.costo_km_ars,
  v.valor_ars,
  v.vtv_vence_el,
  v.seguro_vence_el,
  (v.vtv_vence_el - CURRENT_DATE)                AS dias_para_vtv,
  (v.seguro_vence_el - CURRENT_DATE)             AS dias_para_seguro,
  v.responsable_id,
  (em.nombre || ' ' || em.apellido)              AS responsable,
  v.deposito_base_id,
  de.nombre                                      AS deposito_base,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.vehiculo_id = v.id AND x.estado IN ('programada','en_ejecucion','pausada')) AS ot_en_curso,
  (SELECT COUNT(*) FROM gannet_demo.mantenimientos x WHERE x.vehiculo_id = v.id) AS mantenimientos,
  v.creado_en
FROM gannet_demo.vehiculos v
LEFT JOIN gannet_demo.empleados em ON em.id = v.responsable_id
LEFT JOIN gannet_demo.depositos de ON de.id = v.deposito_base_id
ORDER BY v.dominio;

COMMENT ON VIEW public.gd_vehiculos IS
  'Grilla del modulo de flota: identificacion y estado de cada vehiculo, responsable y deposito base resueltos por nombre, dias restantes hasta la verificacion tecnica y la poliza de seguro, ordenes de trabajo en curso y mantenimientos registrados.';

-- -----------------------------------------------------------------------------
-- gd_equipos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_equipos AS
SELECT
  eq.id                                          AS equipo_id,
  eq.codigo_interno,
  eq.nombre                                      AS equipo,
  eq.categoria,
  eq.marca,
  eq.modelo,
  eq.numero_serie,
  eq.estado,
  eq.es_alquilable,
  eq.tarifa_dia_ars,
  eq.valor_ars,
  eq.proxima_calibracion,
  (eq.proxima_calibracion - CURRENT_DATE)        AS dias_para_calibracion,
  (eq.proxima_calibracion IS NOT NULL
   AND eq.proxima_calibracion < CURRENT_DATE)    AS calibracion_vencida,
  eq.servicio_id,
  se.nombre                                      AS servicio,
  eq.deposito_id,
  de.nombre                                      AS deposito,
  eq.responsable_id,
  (em.nombre || ' ' || em.apellido)              AS responsable,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.equipo_id = eq.id AND x.estado IN ('programada','en_ejecucion','pausada')) AS ot_en_curso,
  (SELECT COUNT(*) FROM gannet_demo.mantenimientos x WHERE x.equipo_id = eq.id) AS mantenimientos,
  eq.creado_en
FROM gannet_demo.equipos eq
LEFT JOIN gannet_demo.servicios se ON se.id = eq.servicio_id
LEFT JOIN gannet_demo.depositos de ON de.id = eq.deposito_id
LEFT JOIN gannet_demo.empleados em ON em.id = eq.responsable_id
ORDER BY eq.codigo_interno;

COMMENT ON VIEW public.gd_equipos IS
  'Grilla del parque de equipos y herramientas, con servicio, deposito y responsable resueltos por nombre, dias restantes hasta la proxima calibracion y la bandera de calibracion vencida, ordenes de trabajo en curso y mantenimientos registrados.';

-- -----------------------------------------------------------------------------
-- gd_proyectos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_proyectos AS
SELECT
  p.id                                           AS proyecto_id,
  p.codigo,
  p.nombre                                       AS proyecto,
  p.tipo_contrato,
  p.estado,
  p.fecha_inicio_plan,
  p.fecha_fin_plan,
  p.fecha_inicio_real,
  p.fecha_fin_real,
  p.avance_pct,
  p.monto_contrato_ars,
  p.monto_ejecutado_ars,
  p.margen_objetivo_pct,
  p.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  p.faena_id,
  fa.nombre                                      AS faena,
  p.servicio_id,
  se.nombre                                      AS servicio,
  p.responsable_id,
  (em.nombre || ' ' || em.apellido)              AS responsable,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x WHERE x.proyecto_id = p.id) AS ot_total,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_compra  x WHERE x.proyecto_id = p.id) AS oc_total,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.facturas x
     WHERE x.proyecto_id = p.id AND x.estado <> 'anulada')                         AS facturado_ars,
  p.creado_en
FROM gannet_demo.proyectos p
LEFT JOIN gannet_demo.clientes  cl ON cl.id = p.cliente_id
LEFT JOIN gannet_demo.faenas    fa ON fa.id = p.faena_id
LEFT JOIN gannet_demo.servicios se ON se.id = p.servicio_id
LEFT JOIN gannet_demo.empleados em ON em.id = p.responsable_id
ORDER BY p.fecha_inicio_plan DESC NULLS LAST, p.codigo;

COMMENT ON VIEW public.gd_proyectos IS
  'Grilla del modulo de proyectos, con cliente, faena, servicio y responsable resueltos por nombre, fechas de plan y reales, avance, montos contratado y ejecutado y los contadores de ordenes de trabajo, ordenes de compra y facturacion asociadas.';

-- -----------------------------------------------------------------------------
-- gd_cotizaciones
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_cotizaciones AS
SELECT
  co.id                                          AS cotizacion_id,
  co.numero,
  co.estado,
  co.fecha_emision,
  co.fecha_validez,
  (co.fecha_validez - CURRENT_DATE)              AS dias_de_validez_restantes,
  (co.fecha_validez IS NOT NULL
   AND co.fecha_validez < CURRENT_DATE)          AS fuera_de_validez,
  co.subtotal_ars,
  co.descuento_pct,
  co.impuestos_ars,
  co.total_ars,
  co.probabilidad_pct,
  (co.total_ars * co.probabilidad_pct / 100.0)::numeric(14,2) AS total_ponderado_ars,
  co.motivo_rechazo,
  co.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  co.contacto_id,
  (ct.nombre || ' ' || ct.apellido)              AS contacto,
  co.proyecto_id,
  pr.nombre                                      AS proyecto,
  co.servicio_principal_id,
  se.nombre                                      AS servicio_principal,
  co.responsable_comercial_id,
  (em.nombre || ' ' || em.apellido)              AS responsable_comercial,
  (SELECT COUNT(*) FROM gannet_demo.cotizacion_items x WHERE x.cotizacion_id = co.id) AS items,
  co.creado_en
FROM gannet_demo.cotizaciones co
LEFT JOIN gannet_demo.clientes  cl ON cl.id = co.cliente_id
LEFT JOIN gannet_demo.contactos ct ON ct.id = co.contacto_id
LEFT JOIN gannet_demo.proyectos pr ON pr.id = co.proyecto_id
LEFT JOIN gannet_demo.servicios se ON se.id = co.servicio_principal_id
LEFT JOIN gannet_demo.empleados em ON em.id = co.responsable_comercial_id
ORDER BY co.fecha_emision DESC NULLS LAST, co.numero DESC;

COMMENT ON VIEW public.gd_cotizaciones IS
  'Grilla del modulo comercial: cotizaciones con cliente, contacto, proyecto, servicio principal y responsable comercial resueltos por nombre, importes, probabilidad de cierre, total ponderado por esa probabilidad, dias de validez restantes y cantidad de renglones.';

-- -----------------------------------------------------------------------------
-- gd_facturas
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_facturas AS
SELECT
  fa.id                                          AS factura_id,
  fa.numero,
  fa.tipo_comprobante,
  fa.estado,
  fa.fecha_emision,
  fa.fecha_vencimiento,
  fa.fecha_cobro,
  fa.neto_ars,
  fa.iva_ars,
  fa.total_ars,
  (fa.estado IN ('emitida','enviada','vencida'))  AS esta_pendiente,
  CASE WHEN fa.estado IN ('emitida','enviada','vencida') AND fa.fecha_vencimiento IS NOT NULL
       THEN GREATEST(CURRENT_DATE - fa.fecha_vencimiento, 0) END AS dias_vencido,
  CASE WHEN fa.estado IN ('emitida','enviada','vencida')
       THEN (fa.fecha_vencimiento - CURRENT_DATE) END            AS dias_para_vencer,
  (fa.fecha_cobro - fa.fecha_emision)             AS dias_hasta_cobro,
  fa.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social)  AS cliente,
  cl.condicion_pago_dias,
  fa.proyecto_id,
  pr.nombre                                       AS proyecto,
  fa.orden_trabajo_id,
  ot.numero                                       AS ot_numero,
  fa.cotizacion_id,
  co.numero                                       AS cotizacion_numero,
  fa.creado_en
FROM gannet_demo.facturas fa
LEFT JOIN gannet_demo.clientes        cl ON cl.id = fa.cliente_id
LEFT JOIN gannet_demo.proyectos       pr ON pr.id = fa.proyecto_id
LEFT JOIN gannet_demo.ordenes_trabajo ot ON ot.id = fa.orden_trabajo_id
LEFT JOIN gannet_demo.cotizaciones    co ON co.id = fa.cotizacion_id
ORDER BY fa.fecha_emision DESC NULLS LAST, fa.numero DESC;

COMMENT ON VIEW public.gd_facturas IS
  'Grilla del modulo de facturacion: comprobantes con cliente, proyecto, orden de trabajo y cotizacion de origen resueltos por nombre o numero, importes desagregados, estado de cobro, dias de mora, dias hasta el vencimiento y dias transcurridos entre emision y cobro.';

-- -----------------------------------------------------------------------------
-- gd_ordenes_compra
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_ordenes_compra AS
SELECT
  oc.id                                          AS orden_compra_id,
  oc.numero,
  oc.estado,
  oc.fecha_emision,
  oc.fecha_entrega_estimada,
  oc.fecha_recepcion,
  (oc.fecha_recepcion - oc.fecha_entrega_estimada) AS dias_desvio_entrega,
  CASE WHEN oc.fecha_recepcion IS NOT NULL AND oc.fecha_entrega_estimada IS NOT NULL
       THEN oc.fecha_recepcion <= oc.fecha_entrega_estimada END AS entregada_en_plazo,
  (oc.estado IN ('aprobada','enviada','recibida_parcial')
   AND oc.fecha_entrega_estimada < CURRENT_DATE)  AS entrega_atrasada,
  oc.total_ars,
  oc.proveedor_id,
  pv.razon_social                                 AS proveedor,
  pv.rubro                                        AS proveedor_rubro,
  oc.proyecto_id,
  pr.nombre                                       AS proyecto,
  oc.orden_trabajo_id,
  ot.numero                                       AS ot_numero,
  oc.solicitante_id,
  (em.nombre || ' ' || em.apellido)               AS solicitante,
  oc.deposito_destino_id,
  de.nombre                                       AS deposito_destino,
  (SELECT COUNT(*) FROM gannet_demo.orden_compra_items x
     WHERE x.orden_compra_id = oc.id)             AS items,
  oc.creado_en
FROM gannet_demo.ordenes_compra oc
LEFT JOIN gannet_demo.proveedores     pv ON pv.id = oc.proveedor_id
LEFT JOIN gannet_demo.proyectos       pr ON pr.id = oc.proyecto_id
LEFT JOIN gannet_demo.ordenes_trabajo ot ON ot.id = oc.orden_trabajo_id
LEFT JOIN gannet_demo.empleados       em ON em.id = oc.solicitante_id
LEFT JOIN gannet_demo.depositos       de ON de.id = oc.deposito_destino_id
ORDER BY oc.fecha_emision DESC NULLS LAST, oc.numero DESC;

COMMENT ON VIEW public.gd_ordenes_compra IS
  'Grilla del modulo de compras: ordenes de compra con proveedor, proyecto, orden de trabajo, solicitante y deposito de destino resueltos por nombre, desvio en dias entre la entrega comprometida y la recepcion real, banderas de entrega en plazo y de atraso vigente, importe y cantidad de renglones.';

-- -----------------------------------------------------------------------------
-- gd_documentos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_documentos AS
SELECT
  dc.id                                          AS documento_id,
  dc.nombre                                      AS documento,
  dc.tipo,
  dc.fecha_emision,
  dc.fecha_vencimiento,
  (dc.fecha_vencimiento - CURRENT_DATE)          AS dias_para_vencer,
  (dc.fecha_vencimiento IS NOT NULL
   AND dc.fecha_vencimiento < CURRENT_DATE)      AS esta_vencido,
  dc.url_archivo,
  dc.tamano_kb,
  CASE
    WHEN dc.cliente_id       IS NOT NULL THEN 'cliente'
    WHEN dc.proyecto_id      IS NOT NULL THEN 'proyecto'
    WHEN dc.orden_trabajo_id IS NOT NULL THEN 'orden_trabajo'
    WHEN dc.empleado_id      IS NOT NULL THEN 'empleado'
    WHEN dc.vehiculo_id      IS NOT NULL THEN 'vehiculo'
    WHEN dc.equipo_id        IS NOT NULL THEN 'equipo'
  END                                            AS entidad_tipo,
  COALESCE(dc.cliente_id, dc.proyecto_id, dc.orden_trabajo_id,
           dc.empleado_id, dc.vehiculo_id, dc.equipo_id) AS entidad_id,
  COALESCE(
    COALESCE(cl.nombre_comercial, cl.razon_social),
    (pr.codigo || ' — ' || pr.nombre),
    (ot.numero || ' — ' || ot.titulo),
    (em.nombre || ' ' || em.apellido),
    (ve.dominio || ' — ' || ve.tipo),
    (eq.codigo_interno || ' — ' || eq.nombre)
  )                                              AS entidad_nombre,
  dc.cliente_id,
  dc.proyecto_id,
  dc.orden_trabajo_id,
  dc.empleado_id,
  dc.vehiculo_id,
  dc.equipo_id,
  dc.creado_en
FROM gannet_demo.documentos dc
LEFT JOIN gannet_demo.clientes        cl ON cl.id = dc.cliente_id
LEFT JOIN gannet_demo.proyectos       pr ON pr.id = dc.proyecto_id
LEFT JOIN gannet_demo.ordenes_trabajo ot ON ot.id = dc.orden_trabajo_id
LEFT JOIN gannet_demo.empleados       em ON em.id = dc.empleado_id
LEFT JOIN gannet_demo.vehiculos       ve ON ve.id = dc.vehiculo_id
LEFT JOIN gannet_demo.equipos         eq ON eq.id = dc.equipo_id
ORDER BY dc.fecha_emision DESC NULLS LAST, dc.id DESC;

COMMENT ON VIEW public.gd_documentos IS
  'Grilla del repositorio documental, con la entidad de la que cuelga cada documento resuelta por nombre y por tipo, sus identificadores para el drill-down, dias restantes hasta el vencimiento y la bandera de documento vencido.';

-- -----------------------------------------------------------------------------
-- gd_articulos
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_articulos AS
SELECT
  ar.id                                          AS articulo_id,
  ar.codigo,
  ar.descripcion                                 AS articulo,
  ar.categoria,
  ar.unidad_medida,
  ar.stock_minimo,
  ar.costo_unitario_ars,
  ar.activo,
  COALESCE(st.cantidad_total, 0)                 AS stock_total,
  COALESCE(st.depositos, 0)                      AS depositos_con_stock,
  (COALESCE(st.cantidad_total, 0) * COALESCE(ar.costo_unitario_ars, 0))::numeric(14,2)
                                                 AS valorizado_ars,
  (ar.stock_minimo IS NOT NULL
   AND COALESCE(st.cantidad_total, 0) < ar.stock_minimo) AS bajo_minimo,
  (SELECT MAX(mv.fecha) FROM gannet_demo.movimientos_stock mv
     WHERE mv.articulo_id = ar.id)               AS ultimo_movimiento_en,
  (SELECT COUNT(*) FROM gannet_demo.orden_compra_items oi
     WHERE oi.articulo_id = ar.id)               AS veces_comprado,
  ar.creado_en
FROM gannet_demo.articulos ar
LEFT JOIN (
  SELECT articulo_id, SUM(cantidad) AS cantidad_total, COUNT(*) AS depositos
  FROM gannet_demo.stock
  GROUP BY articulo_id
) st ON st.articulo_id = ar.id
ORDER BY ar.codigo;

COMMENT ON VIEW public.gd_articulos IS
  'Grilla del catalogo de materiales e insumos, con la existencia total consolidada entre todos los depositos, su valorizacion, la bandera de articulo bajo el stock minimo, la fecha del ultimo movimiento y la cantidad de veces que fue comprado.';

-- -----------------------------------------------------------------------------
-- gd_faenas
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_faenas AS
SELECT
  fa.id                                          AS faena_id,
  fa.nombre                                      AS faena,
  fa.tipo,
  fa.provincia,
  fa.altitud_msnm,
  fa.latitud,
  fa.longitud,
  fa.activa,
  fa.cliente_id,
  COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
  cl.mineral_principal,
  (SELECT COUNT(*) FROM gannet_demo.proyectos x WHERE x.faena_id = fa.id) AS proyectos,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x WHERE x.faena_id = fa.id) AS ot_total,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo x
     WHERE x.faena_id = fa.id AND x.estado IN ('programada','en_ejecucion','pausada')) AS ot_abiertas,
  (SELECT COUNT(*) FROM gannet_demo.contactos x WHERE x.faena_id = fa.id AND x.activo) AS contactos,
  (SELECT COUNT(DISTINCT x.empleado_id) FROM gannet_demo.turnos x
     WHERE x.faena_id = fa.id
       AND x.fecha >= date_trunc('month', CURRENT_DATE)::date)                          AS personal_mes,
  fa.creado_en
FROM gannet_demo.faenas fa
LEFT JOIN gannet_demo.clientes cl ON cl.id = fa.cliente_id
ORDER BY cl.razon_social, fa.nombre;

COMMENT ON VIEW public.gd_faenas IS
  'Grilla de los emplazamientos donde Andes presta servicios, con el cliente propietario resuelto por nombre, coordenadas y altitud para el mapa, y los contadores de proyectos, ordenes de trabajo abiertas, contactos y personal distinto que registro turnos en el mes en curso.';

-- -----------------------------------------------------------------------------
-- gd_proveedores
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.gd_proveedores AS
SELECT
  pv.id                                          AS proveedor_id,
  pv.razon_social                                AS proveedor,
  pv.cuit,
  pv.rubro,
  pv.contacto,
  pv.email,
  pv.telefono,
  pv.condicion_pago_dias,
  pv.calificacion,
  pv.activo,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_compra x WHERE x.proveedor_id = pv.id) AS oc_total,
  (SELECT COUNT(*) FROM gannet_demo.ordenes_compra x
     WHERE x.proveedor_id = pv.id
       AND x.estado IN ('aprobada','enviada','recibida_parcial'))                   AS oc_en_curso,
  (SELECT COALESCE(SUM(x.total_ars), 0) FROM gannet_demo.ordenes_compra x
     WHERE x.proveedor_id = pv.id AND x.estado <> 'cancelada')                      AS monto_comprado_ars,
  (SELECT MAX(x.fecha_emision) FROM gannet_demo.ordenes_compra x
     WHERE x.proveedor_id = pv.id)                                                  AS ultima_compra_el,
  (SELECT COUNT(*) FROM gannet_demo.mantenimientos x WHERE x.proveedor_id = pv.id)  AS mantenimientos,
  pv.creado_en
FROM gannet_demo.proveedores pv
ORDER BY pv.razon_social;

COMMENT ON VIEW public.gd_proveedores IS
  'Grilla de proveedores DE Andes, es decir quienes le venden materiales, servicios y subcontratos. No confundir con la vista legada demo_proveedores del esquema demo_mineria, que responde al modelo inverso. Incluye ordenes de compra totales y en curso, monto comprado, ultima compra y mantenimientos ejecutados.';

-- =============================================================================
-- PRIVILEGIOS — cierre de la superficie de lectura
--
-- Este bloque es la parte critica de la migracion. La base tiene ALTER DEFAULT
-- PRIVILEGES en el esquema `public` concediendo ALL sobre TABLES a `anon`,
-- `authenticated` y `service_role`. Por lo tanto cada vista creada arriba nacio
-- con privilegios de escritura para `anon`, y un GRANT SELECT solo no revierte
-- eso: el GRANT agrega, nunca quita.
--
-- Por eso el orden es REVOKE ALL primero y GRANT SELECT despues, aplicado en
-- bucle sobre todas las vistas `public.gd_*`. El bucle es intencional: cubre
-- automaticamente toda vista futura con el mismo prefijo sin que haya que
-- acordarse de escribir su grant.
--
-- Verificacion esperada, para cada vista y para `anon` y `authenticated`:
--   has_table_privilege(rol, vista, 'SELECT') = true
--   has_table_privilege(rol, vista, 'INSERT') = false
--   has_table_privilege(rol, vista, 'UPDATE') = false
--   has_table_privilege(rol, vista, 'DELETE') = false
-- =============================================================================

DO $$
DECLARE
  v record;
BEGIN
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname LIKE 'gd\_%'
    ORDER BY c.relname
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', v.relname);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', v.relname);
      EXECUTE format('GRANT SELECT ON public.%I TO anon', v.relname);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', v.relname);
      EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v.relname);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM service_role', v.relname);
      EXECUTE format('GRANT SELECT ON public.%I TO service_role', v.relname);
    END IF;
  END LOOP;
END;
$$;

-- Comprobacion en linea: si alguna vista `gd_*` quedara con privilegio de
-- escritura para `anon` o `authenticated`, la migracion aborta en lugar de
-- dejar el agujero abierto en silencio.
DO $$
DECLARE
  faltas text;
BEGIN
  SELECT string_agg(c.relname || ' (' || r.rolname || ')', ', ')
  INTO faltas
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  CROSS JOIN (SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')) r
  WHERE n.nspname = 'public'
    AND c.relkind = 'v'
    AND c.relname LIKE 'gd\_%'
    AND (
      NOT has_table_privilege(r.rolname, c.oid, 'SELECT')
      OR has_table_privilege(r.rolname, c.oid, 'INSERT')
      OR has_table_privilege(r.rolname, c.oid, 'UPDATE')
      OR has_table_privilege(r.rolname, c.oid, 'DELETE')
    );

  IF faltas IS NOT NULL THEN
    RAISE EXCEPTION 'Privilegios incorrectos en vistas gd_*: %', faltas;
  END IF;
END;
$$;

COMMIT;
