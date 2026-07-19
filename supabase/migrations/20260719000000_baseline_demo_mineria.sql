-- =============================================================================
-- BASELINE DE CAPTURA — esquema `demo_mineria` + vistas `public.demo_*`
-- =============================================================================
--
-- QUE ES ESTE ARCHIVO
--   Es un BASELINE, no un cambio. Captura y versiona el estado que el esquema
--   `demo_mineria` y las cinco vistas `public.demo_*` YA TIENEN en la base
--   remota. Ese estado fue creado fuera de `supabase/migrations/` y hasta hoy
--   no estaba versionado en el repositorio.
--
-- POR QUE EXISTE
--   La demo del congreso minero debe poder levantarse desde cero en una
--   instancia local de PostgreSQL (plan B ante fallas de conectividad en el
--   predio). Sin este archivo, una base nueva no reproduce las pantallas ya
--   existentes que consumen las vistas `public.demo_*`.
--
-- ORIGEN DEL DDL
--   Extraido con `pg_dump --schema-only --schema=demo_mineria` sobre la base
--   remota, mas la definicion de las cinco vistas `public.demo_*` obtenida de
--   `pg_views`, con sus privilegios reales leidos de `pg_class.relacl`.
--
-- NO APLICAR CONTRA LA BASE REMOTA
--   La base remota ya se encuentra en este estado. Este archivo solo debe
--   ejecutarse sobre bases nuevas (local, efimeras, de prueba). Es idempotente,
--   de modo que una ejecucion accidental sobre la base remota no altera datos
--   ni estructura.
--
-- CONTEXTO DE NEGOCIO
--   `demo_mineria` modela la vision ANTERIOR de la demo: el usuario del sistema
--   era la empresa minera y observaba a SUS proveedores. La vision vigente
--   invierte los roles (el usuario es el proveedor "Andes Servicios Integrales
--   S.A." y las mineras son sus clientes) y se materializa en el esquema
--   `gannet_demo`. Este baseline se conserva unicamente para no romper las
--   pantallas ya desplegadas mientras dura la transicion.
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- ESQUEMA
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS demo_mineria;

COMMENT ON SCHEMA demo_mineria IS
  'Esquema legado de la demo minera (vision anterior: el usuario es la minera y observa a sus proveedores). Congelado. La vision vigente vive en el esquema gannet_demo.';

-- =============================================================================
-- TABLAS
-- =============================================================================

-- Proveedores observados por la minera. NO confundir con gannet_demo.proveedores,
-- que modela a los proveedores DE Andes Servicios Integrales S.A.
CREATE TABLE IF NOT EXISTS demo_mineria.proveedores (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre     text NOT NULL,
    rubro      text NOT NULL,
    cuit       text NOT NULL,
    contacto   text,
    email      text,
    activo     boolean NOT NULL DEFAULT true,
    creado_en  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT proveedores_rubro_check
      CHECK (rubro IN ('gas', 'transporte', 'personal', 'obras'))
);

COMMENT ON TABLE demo_mineria.proveedores IS
  'Proveedores de la empresa minera en el modelo legado. Solo cuatro rubros, insuficientes para los diez servicios de la vision vigente.';

-- Entregas de gas realizadas por un proveedor del rubro gas.
CREATE TABLE IF NOT EXISTS demo_mineria.entregas_gas (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proveedor_id  bigint NOT NULL REFERENCES demo_mineria.proveedores(id),
    fecha         date NOT NULL,
    mina_destino  text NOT NULL,
    producto      text NOT NULL,
    volumen_m3    numeric(10,1) NOT NULL,
    patente       text NOT NULL,
    estado        text NOT NULL,
    monto_ars     numeric(12,2) NOT NULL,
    CONSTRAINT entregas_gas_estado_check
      CHECK (estado IN ('entregado', 'en_ruta', 'programado'))
);

COMMENT ON TABLE demo_mineria.entregas_gas IS
  'Entregas de gas del modelo legado. La mina de destino se guarda como texto libre, no como entidad.';

-- Viajes de transporte realizados por un proveedor del rubro transporte.
CREATE TABLE IF NOT EXISTS demo_mineria.viajes_transporte (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proveedor_id  bigint NOT NULL REFERENCES demo_mineria.proveedores(id),
    fecha         date NOT NULL,
    origen        text NOT NULL,
    destino       text NOT NULL,
    km            integer NOT NULL,
    carga_tn      numeric(8,1) NOT NULL,
    chofer        text NOT NULL,
    estado        text NOT NULL,
    costo_ars     numeric(12,2) NOT NULL,
    CONSTRAINT viajes_transporte_estado_check
      CHECK (estado IN ('completado', 'en_ruta', 'programado'))
);

COMMENT ON TABLE demo_mineria.viajes_transporte IS
  'Viajes de transporte del modelo legado. Origen, destino y chofer se guardan como texto libre.';

-- Turnos de personal aportado por un proveedor del rubro personal.
CREATE TABLE IF NOT EXISTS demo_mineria.turnos_personal (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proveedor_id  bigint NOT NULL REFERENCES demo_mineria.proveedores(id),
    fecha         date NOT NULL,
    trabajador    text NOT NULL,
    rol           text NOT NULL,
    mina          text NOT NULL,
    turno         text NOT NULL,
    horas         numeric(4,1) NOT NULL,
    estado        text NOT NULL,
    CONSTRAINT turnos_personal_estado_check
      CHECK (estado IN ('presente', 'ausente', 'licencia')),
    CONSTRAINT turnos_personal_turno_check
      CHECK (turno IN ('mañana', 'tarde', 'noche'))
);

COMMENT ON TABLE demo_mineria.turnos_personal IS
  'Turnos de personal del modelo legado. El trabajador se guarda como texto libre, no como entidad de recursos humanos.';

-- Avances de obra ejecutados por un proveedor del rubro obras.
CREATE TABLE IF NOT EXISTS demo_mineria.avances_obra (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    proveedor_id      bigint NOT NULL REFERENCES demo_mineria.proveedores(id),
    obra              text NOT NULL,
    mina              text NOT NULL,
    fecha             date NOT NULL,
    avance_pct        integer NOT NULL,
    hito_actual       text NOT NULL,
    estado            text NOT NULL,
    presupuesto_ars   numeric(14,2) NOT NULL,
    CONSTRAINT avances_obra_avance_pct_check
      CHECK (avance_pct >= 0 AND avance_pct <= 100),
    CONSTRAINT avances_obra_estado_check
      CHECK (estado IN ('en_curso', 'demorado', 'finalizado'))
);

COMMENT ON TABLE demo_mineria.avances_obra IS
  'Avances de obra del modelo legado. La columna mina contiene nombres de mina como texto libre, limitacion que motivo el rediseño hacia gannet_demo.';

-- =============================================================================
-- VISTA INTERNA DEL ESQUEMA LEGADO
-- =============================================================================

CREATE OR REPLACE VIEW demo_mineria.resumen_rubros AS
 SELECT 'gas'::text AS rubro,
    count(*) AS registros,
    COALESCE(sum(entregas_gas.monto_ars), (0)::numeric) AS total_ars
   FROM demo_mineria.entregas_gas
UNION ALL
 SELECT 'transporte'::text AS rubro,
    count(*) AS registros,
    COALESCE(sum(viajes_transporte.costo_ars), (0)::numeric) AS total_ars
   FROM demo_mineria.viajes_transporte
UNION ALL
 SELECT 'personal'::text AS rubro,
    count(*) AS registros,
    0 AS total_ars
   FROM demo_mineria.turnos_personal
UNION ALL
 SELECT 'obras'::text AS rubro,
    count(*) AS registros,
    COALESCE(sum(avances_obra.presupuesto_ars), (0)::numeric) AS total_ars
   FROM demo_mineria.avances_obra;

COMMENT ON VIEW demo_mineria.resumen_rubros IS
  'Totales agregados por rubro sobre las cuatro tablas de actividad del modelo legado.';

-- =============================================================================
-- VISTAS PUBLICAS `public.demo_*`
-- Superficie de lectura consumida por Mission Control. Se exponen en `public`
-- porque PostgREST solo publica ese esquema en esta instalacion.
-- =============================================================================

CREATE OR REPLACE VIEW public.demo_proveedores AS
 SELECT proveedores.id,
    proveedores.nombre,
    proveedores.rubro,
    proveedores.cuit,
    proveedores.contacto,
    proveedores.email,
    proveedores.activo
   FROM demo_mineria.proveedores;

COMMENT ON VIEW public.demo_proveedores IS
  'Listado plano de proveedores del modelo legado, expuesto a la aplicacion.';

CREATE OR REPLACE VIEW public.demo_resumen_rubros AS
 SELECT resumen_rubros.rubro,
    resumen_rubros.registros,
    resumen_rubros.total_ars
   FROM demo_mineria.resumen_rubros;

COMMENT ON VIEW public.demo_resumen_rubros IS
  'Proyeccion publica de demo_mineria.resumen_rubros: registros y monto total por rubro.';

CREATE OR REPLACE VIEW public.demo_actividad_reciente AS
 SELECT 'gas'::text AS rubro,
    g.fecha,
    p.nombre AS proveedor,
    ((g.producto || ' → '::text) || g.mina_destino) AS detalle,
    g.volumen_m3 AS cantidad,
    'm3'::text AS unidad,
    g.monto_ars AS monto,
    g.estado
   FROM (demo_mineria.entregas_gas g
     JOIN demo_mineria.proveedores p ON ((p.id = g.proveedor_id)))
UNION ALL
 SELECT 'transporte'::text AS rubro,
    t.fecha,
    p.nombre AS proveedor,
    ((t.origen || ' → '::text) || t.destino) AS detalle,
    t.carga_tn AS cantidad,
    'tn'::text AS unidad,
    t.costo_ars AS monto,
    t.estado
   FROM (demo_mineria.viajes_transporte t
     JOIN demo_mineria.proveedores p ON ((p.id = t.proveedor_id)))
UNION ALL
 SELECT 'personal'::text AS rubro,
    tp.fecha,
    p.nombre AS proveedor,
    ((tp.rol || ' @ '::text) || tp.mina) AS detalle,
    tp.horas AS cantidad,
    'hs'::text AS unidad,
    NULL::numeric AS monto,
    tp.estado
   FROM (demo_mineria.turnos_personal tp
     JOIN demo_mineria.proveedores p ON ((p.id = tp.proveedor_id)))
UNION ALL
 SELECT 'obras'::text AS rubro,
    o.fecha,
    p.nombre AS proveedor,
    (((o.obra || ' ('::text) || o.avance_pct) || '%)'::text) AS detalle,
    o.avance_pct AS cantidad,
    '%'::text AS unidad,
    o.presupuesto_ars AS monto,
    o.estado
   FROM (demo_mineria.avances_obra o
     JOIN demo_mineria.proveedores p ON ((p.id = o.proveedor_id)));

COMMENT ON VIEW public.demo_actividad_reciente IS
  'Linea de tiempo unificada de las cuatro tablas de actividad del modelo legado, normalizada a una fila por evento.';

CREATE OR REPLACE VIEW public.demo_proveedor_actividad AS
 SELECT g.proveedor_id,
    p.nombre AS proveedor,
    'gas'::text AS rubro,
    g.fecha,
    ((g.producto || ' → '::text) || g.mina_destino) AS detalle,
    g.volumen_m3 AS cantidad,
    'm3'::text AS unidad,
    g.monto_ars AS monto,
    g.estado
   FROM (demo_mineria.entregas_gas g
     JOIN demo_mineria.proveedores p ON ((p.id = g.proveedor_id)))
UNION ALL
 SELECT t.proveedor_id,
    p.nombre AS proveedor,
    'transporte'::text AS rubro,
    t.fecha,
    ((t.origen || ' → '::text) || t.destino) AS detalle,
    t.carga_tn AS cantidad,
    'tn'::text AS unidad,
    t.costo_ars AS monto,
    t.estado
   FROM (demo_mineria.viajes_transporte t
     JOIN demo_mineria.proveedores p ON ((p.id = t.proveedor_id)))
UNION ALL
 SELECT tp.proveedor_id,
    p.nombre AS proveedor,
    'personal'::text AS rubro,
    tp.fecha,
    ((tp.rol || ' @ '::text) || tp.mina) AS detalle,
    tp.horas AS cantidad,
    'hs'::text AS unidad,
    NULL::numeric AS monto,
    tp.estado
   FROM (demo_mineria.turnos_personal tp
     JOIN demo_mineria.proveedores p ON ((p.id = tp.proveedor_id)))
UNION ALL
 SELECT o.proveedor_id,
    p.nombre AS proveedor,
    'obras'::text AS rubro,
    o.fecha,
    (((o.obra || ' ('::text) || o.avance_pct) || '%)'::text) AS detalle,
    o.avance_pct AS cantidad,
    '%'::text AS unidad,
    o.presupuesto_ars AS monto,
    o.estado
   FROM (demo_mineria.avances_obra o
     JOIN demo_mineria.proveedores p ON ((p.id = o.proveedor_id)));

COMMENT ON VIEW public.demo_proveedor_actividad IS
  'Misma linea de tiempo que demo_actividad_reciente pero conservando proveedor_id, para filtrar la actividad de un proveedor puntual.';

CREATE OR REPLACE VIEW public.demo_proveedor_detalle AS
 WITH act AS (
         SELECT entregas_gas.proveedor_id,
            entregas_gas.fecha,
            entregas_gas.estado,
            entregas_gas.monto_ars AS monto,
            entregas_gas.volumen_m3 AS cantidad
           FROM demo_mineria.entregas_gas
        UNION ALL
         SELECT viajes_transporte.proveedor_id,
            viajes_transporte.fecha,
            viajes_transporte.estado,
            viajes_transporte.costo_ars,
            viajes_transporte.carga_tn
           FROM demo_mineria.viajes_transporte
        UNION ALL
         SELECT turnos_personal.proveedor_id,
            turnos_personal.fecha,
            turnos_personal.estado,
            NULL::numeric AS "numeric",
            turnos_personal.horas
           FROM demo_mineria.turnos_personal
        UNION ALL
         SELECT avances_obra.proveedor_id,
            avances_obra.fecha,
            avances_obra.estado,
            NULL::numeric AS "numeric",
            NULL::numeric AS "numeric"
           FROM demo_mineria.avances_obra
        ), obra_vigente AS (
         SELECT DISTINCT ON (o.proveedor_id, o.obra) o.proveedor_id,
            o.obra,
            o.fecha,
            o.presupuesto_ars,
            o.avance_pct
           FROM demo_mineria.avances_obra o
          ORDER BY o.proveedor_id, o.obra, o.fecha DESC, o.id DESC
        ), obra_cartera AS (
         SELECT obra_vigente.proveedor_id,
            sum(obra_vigente.presupuesto_ars) AS presupuesto_cartera,
            sum(obra_vigente.presupuesto_ars) FILTER (WHERE (obra_vigente.fecha >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date)) AS presupuesto_mes,
            count(*) AS obras_en_cartera,
            (round(avg(obra_vigente.avance_pct)))::integer AS avance_promedio
           FROM obra_vigente
          GROUP BY obra_vigente.proveedor_id
        ), agg AS (
         SELECT act.proveedor_id,
            count(*) AS actividades_total,
            count(*) FILTER (WHERE (act.fecha >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date)) AS actividades_mes,
            count(*) FILTER (WHERE ((act.fecha >= ((date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone) - '1 mon'::interval))::date) AND (act.fecha < (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date))) AS actividades_mes_anterior,
            sum(act.monto) AS monto_total_ars,
            sum(act.monto) FILTER (WHERE (act.fecha >= (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date)) AS monto_mes_ars,
            sum(act.cantidad) AS cantidad_total,
            max(act.fecha) AS ultima_actividad,
            count(*) FILTER (WHERE (act.estado <> ALL (ARRAY['en_ruta'::text, 'en_curso'::text, 'programado'::text, 'ausente'::text, 'demorado'::text]))) AS actividades_ok,
            count(*) FILTER (WHERE (act.estado = ANY (ARRAY['en_ruta'::text, 'en_curso'::text, 'programado'::text]))) AS actividades_en_curso,
            count(*) FILTER (WHERE (act.estado = ANY (ARRAY['ausente'::text, 'demorado'::text]))) AS actividades_alerta
           FROM act
          GROUP BY act.proveedor_id
        )
 SELECT p.id AS proveedor_id,
    p.nombre AS proveedor,
    p.rubro,
    p.cuit,
    p.contacto,
    p.email,
    p.activo,
    COALESCE(a.actividades_total, (0)::bigint) AS actividades_total,
    COALESCE(a.actividades_mes, (0)::bigint) AS actividades_mes,
    COALESCE(a.actividades_mes_anterior, (0)::bigint) AS actividades_mes_anterior,
        CASE
            WHEN (p.rubro = 'obras'::text) THEN c.presupuesto_cartera
            ELSE a.monto_total_ars
        END AS monto_total_ars,
        CASE
            WHEN (p.rubro = 'obras'::text) THEN c.presupuesto_mes
            ELSE a.monto_mes_ars
        END AS monto_mes_ars,
    a.ultima_actividad,
    (CURRENT_DATE - a.ultima_actividad) AS dias_sin_actividad,
    COALESCE(a.actividades_ok, (0)::bigint) AS actividades_ok,
    COALESCE(a.actividades_en_curso, (0)::bigint) AS actividades_en_curso,
    COALESCE(a.actividades_alerta, (0)::bigint) AS actividades_alerta,
        CASE
            WHEN (NOT p.activo) THEN 'inactivo'::text
            WHEN (COALESCE(a.actividades_total, (0)::bigint) = 0) THEN 'sin_actividad'::text
            WHEN ((CURRENT_DATE - a.ultima_actividad) > 7) THEN 'en_riesgo'::text
            ELSE 'operativo'::text
        END AS estado_operativo,
    a.cantidad_total,
        CASE p.rubro
            WHEN 'gas'::text THEN 'm3'::text
            WHEN 'transporte'::text THEN 'tn'::text
            WHEN 'personal'::text THEN 'hs'::text
            ELSE NULL::text
        END AS cantidad_unidad,
    c.obras_en_cartera,
    c.avance_promedio
   FROM ((demo_mineria.proveedores p
     LEFT JOIN agg a ON ((a.proveedor_id = p.id)))
     LEFT JOIN obra_cartera c ON ((c.proveedor_id = p.id)));

COMMENT ON VIEW public.demo_proveedor_detalle IS
  'Ficha agregada por proveedor del modelo legado: volumen de actividad, montos del mes y acumulados, dias sin actividad y estado operativo derivado.';

-- =============================================================================
-- PRIVILEGIOS
-- Refleja el estado real de la base remota: el esquema demo_mineria queda
-- reservado al propietario y a service_role, mientras que la lectura publica se
-- concede unicamente sobre las vistas `public.demo_*`.
-- =============================================================================

GRANT USAGE ON SCHEMA demo_mineria TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA demo_mineria TO service_role;

GRANT SELECT ON public.demo_proveedores          TO anon, authenticated, service_role;
GRANT SELECT ON public.demo_resumen_rubros       TO anon, authenticated, service_role;
GRANT SELECT ON public.demo_actividad_reciente   TO anon, authenticated, service_role;
GRANT SELECT ON public.demo_proveedor_detalle    TO anon, authenticated, service_role;
GRANT SELECT ON public.demo_proveedor_actividad  TO anon, authenticated, service_role;

COMMIT;
