-- =============================================================================
-- Gannet OS — Demo Congreso Minero
-- Flota: catalogo real de marca/modelo + aptitud para circular
-- =============================================================================
--
-- WHY THIS MIGRATION EXISTS
--
--   Two defects were found on the running preview. Neither is caught by tsc,
--   the build, or a security review — they only surface in a browser, in front
--   of the exact audience the demo is built for.
--
--   1. IMPOSSIBLE VEHICLES
--      The seed generator drew `marca` and `modelo` as two independent hashes,
--      so the fleet contained units such as "Volvo Atego", "Iveco Atego" and
--      "Grove Arocs 3345". Atego is a Mercedes-Benz model; Grove builds cranes,
--      not concrete mixers. A fleet manager reads one of those rows and, from
--      that second on, treats every other number on screen as invented.
--      Brand and model are now drawn as ONE indivisible pair.
--
--   2. THE FLEET KPI CONTRADICTED ITS OWN TABLE
--      The module showed "38 / 45 en condiciones de circular" while the table
--      right below it listed vehicles flagged OPERATIVO whose technical
--      inspection (VTV) had expired 20 days earlier. Both numbers came from
--      the same view, so the screen argued with itself.
--
--      `esta_operativo` only ever meant MECHANICAL availability. A vehicle
--      with an expired VTV is mechanically fine and legally grounded — those
--      are different questions, and the view only answered the first one.
--
--      DECISION: keep the data (an operativo unit with a lapsed VTV is a real
--      and common situation, and surfacing it is the product's argument), and
--      make the view answer the second question explicitly. A new
--      `apto_circular` flag requires mechanical availability AND a valid VTV
--      AND a valid insurance policy, and `motivo_no_apto` states which of the
--      three failed. The KPI now counts `apto_circular` and the table shows
--      the same flag per row, so the number can be audited on screen.
--      `esta_operativo` is kept, unchanged, as the mechanical figure.
--
-- SECURITY — READ BEFORE EDITING
--
--   This database carries the Supabase default:
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT ALL ON TABLES TO anon, authenticated, service_role;
--
--   Every view DROPped and re-CREATEd in `public` is therefore BORN with the
--   full privilege set (arwdDxt) for `anon`. A later `GRANT SELECT` removes
--   nothing — it is a no-op. The only way to close the surface is to REVOKE
--   the write privileges explicitly and only then grant SELECT. This hole has
--   already been shipped once in this project. The PRIVILEGIOS block below is
--   not optional, and the closing assertions abort the migration rather than
--   leave a writable view behind.
--
-- IDEMPOTENCE
--   Single transaction. The vehicle UPDATE recomputes marca/modelo from the
--   vehicle id with the same pure hash the generator uses, so re-applying the
--   migration is a no-op. A database seeded from scratch with the updated
--   generator already satisfies it.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CATALOGO DE FLOTA — marca y modelo como par indivisible
-- =============================================================================
-- The expression below is a byte-for-byte mirror of block 8 of
-- `supabase/seeds/gannet_demo_seed.sql`. If one changes, the other must change
-- with it, or a laptop seeded from scratch and the VPS stop agreeing.
--
-- Determinism: `gannet_demo.sem_h(i, seed)` is a pure md5-based hash of the row
-- id. No random(), no setseed(), no dependence on query plan or row order.
--
-- The seed script DROPs its determinism primitives on its last lines, so
-- `gannet_demo.sem_h` does not exist at migration time. Its body is inlined
-- below verbatim rather than recreated, so this migration leaves no function
-- behind that the generator would later drop out from under it.
-- =============================================================================

WITH hashes AS (
  SELECT
    g.i,
    -- Inlined gannet_demo.sem_h(g.i, 609).
    ((('x' || substr(md5(g.i::text || ':' || 609::text), 1, 8))::bit(32)::int)::bigint
      + 2147483648) AS h
  FROM generate_series(1, 45) AS g(i)
),
catalogo AS (
  SELECT
    g.i,
    CASE
      -- 1..12 camioneta — pickups
      WHEN g.i <= 12 THEN (ARRAY[
        'Toyota|Hilux 4x4 DC',
        'Ford|Ranger 4x4 DC',
        'Volkswagen|Amarok V6 4x4',
        'Nissan|Frontier 4x4'
      ])[1 + g.h % 4]
      -- 13..22 camion — rigid trucks
      WHEN g.i <= 22 THEN (ARRAY[
        'Mercedes-Benz|Atego 1726',
        'Iveco|Tector 240E28',
        'Scania|P360 6x4',
        'Volvo|VM 330',
        'Ford|Cargo 1723',
        'Volkswagen|Constellation 17.280'
      ])[1 + g.h % 6]
      -- 23..28 tractor_semi — road tractors
      WHEN g.i <= 28 THEN (ARRAY[
        'Scania|R450 6x2',
        'Volvo|FH 460',
        'Iveco|Stralis 480',
        'Mercedes-Benz|Actros 2045'
      ])[1 + g.h % 4]
      -- 29..32 minibus — crew transport
      WHEN g.i <= 32 THEN (ARRAY[
        'Mercedes-Benz|Sprinter 21+1',
        'Iveco|Daily 50C17'
      ])[1 + g.h % 2]
      -- 33..38 utilitario — light vans
      WHEN g.i <= 38 THEN (ARRAY[
        'Renault|Kangoo Furgón',
        'Fiat|Fiorino Fire',
        'Peugeot|Partner Confort'
      ])[1 + g.h % 3]
      -- 39..40 grua — cranes
      WHEN g.i <= 40 THEN (ARRAY[
        'Grove|RT540E',
        'Palfinger|PK 23002'
      ])[1 + g.h % 2]
      -- 41..42 hormigonera — concrete mixers
      WHEN g.i <= 42 THEN (ARRAY[
        'Mercedes-Benz|Arocs 3345',
        'Iveco|Trakker 380'
      ])[1 + g.h % 2]
      -- 43..44 cisterna — tankers
      WHEN g.i <= 44 THEN (ARRAY[
        'Scania|G410 6x4',
        'Ford|Cargo 1729'
      ])[1 + g.h % 2]
      -- 45 ambulancia
      ELSE 'Mercedes-Benz|Sprinter 415'
    END AS marca_modelo
  FROM hashes g
)
UPDATE gannet_demo.vehiculos v
SET marca  = split_part(c.marca_modelo, '|', 1),
    modelo = split_part(c.marca_modelo, '|', 2)
FROM catalogo c
WHERE c.i = v.id
  AND (v.marca  IS DISTINCT FROM split_part(c.marca_modelo, '|', 1)
    OR v.modelo IS DISTINCT FROM split_part(c.marca_modelo, '|', 2));

-- Assertion: no vehicle may be left carrying a model that does not belong to
-- its brand. The pair list is the authority, so membership is checked against
-- the exact pairs, not against a brand list.
DO $$
DECLARE
  huerfano text;
BEGIN
  SELECT string_agg(v.dominio || ' (' || v.marca || ' ' || v.modelo || ')', ', ')
  INTO huerfano
  FROM gannet_demo.vehiculos v
  WHERE (v.marca || '|' || v.modelo) <> ALL (ARRAY[
    'Toyota|Hilux 4x4 DC','Ford|Ranger 4x4 DC','Volkswagen|Amarok V6 4x4','Nissan|Frontier 4x4',
    'Mercedes-Benz|Atego 1726','Iveco|Tector 240E28','Scania|P360 6x4','Volvo|VM 330',
    'Ford|Cargo 1723','Volkswagen|Constellation 17.280',
    'Scania|R450 6x2','Volvo|FH 460','Iveco|Stralis 480','Mercedes-Benz|Actros 2045',
    'Mercedes-Benz|Sprinter 21+1','Iveco|Daily 50C17',
    'Renault|Kangoo Furgón','Fiat|Fiorino Fire','Peugeot|Partner Confort',
    'Grove|RT540E','Palfinger|PK 23002',
    'Mercedes-Benz|Arocs 3345','Iveco|Trakker 380',
    'Scania|G410 6x4','Ford|Cargo 1729',
    'Mercedes-Benz|Sprinter 415'
  ]);

  IF huerfano IS NOT NULL THEN
    RAISE EXCEPTION 'Vehiculos con marca y modelo incompatibles: %', huerfano;
  END IF;
END $$;

-- =============================================================================
-- 2. gd_flota_estado — se agregan `apto_circular` y `motivo_no_apto`
-- =============================================================================
-- DROP + CREATE instead of CREATE OR REPLACE: the new columns belong beside
-- `esta_operativo`, and CREATE OR REPLACE can only append at the end. The cost
-- of dropping is that the view is reborn with default privileges, which the
-- PRIVILEGIOS block below undoes.
-- =============================================================================

DROP VIEW IF EXISTS public.gd_flota_estado;

CREATE VIEW public.gd_flota_estado AS
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
  -- Disponibilidad MECANICA. No dice nada sobre la documentacion del vehiculo.
  (v.estado = 'operativo')                      AS esta_operativo,
  -- Aptitud LEGAL para circular: mecanica disponible Y verificacion tecnica
  -- vigente Y poliza de seguro vigente. Es la cifra que el panel publica como
  -- "en condiciones de circular", y la que la grilla repite fila por fila.
  (v.estado = 'operativo'
   AND (v.vtv_vence_el    IS NULL OR v.vtv_vence_el    >= CURRENT_DATE)
   AND (v.seguro_vence_el IS NULL OR v.seguro_vence_el >= CURRENT_DATE)) AS apto_circular,
  -- Motivo unico y accionable. El orden es deliberado: primero lo que saca al
  -- vehiculo de la calle por ley, despues lo mecanico.
  (CASE
     WHEN v.vtv_vence_el IS NOT NULL AND v.vtv_vence_el < CURRENT_DATE
       THEN 'VTV vencida'
     WHEN v.seguro_vence_el IS NOT NULL AND v.seguro_vence_el < CURRENT_DATE
       THEN 'Seguro vencido'
     WHEN v.estado = 'en_mantenimiento' THEN 'En mantenimiento'
     WHEN v.estado = 'fuera_servicio'   THEN 'Fuera de servicio'
     WHEN v.estado = 'baja'             THEN 'Dado de baja'
     ELSE NULL
   END)                                         AS motivo_no_apto,
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
  'Situacion de cada vehiculo de la flota propia: estado, kilometraje, antiguedad, valor, responsable y deposito base resueltos por nombre, vencimientos de verificacion tecnica y de poliza de seguro con sus dias restantes y banderas de vencido o por vencer en treinta dias, ordenes de trabajo en curso asignadas, mantenimientos pendientes y costo de mantenimiento acumulado. Distingue dos preguntas distintas: `esta_operativo` es disponibilidad mecanica, mientras que `apto_circular` exige ademas verificacion tecnica y poliza vigentes, y `motivo_no_apto` indica cual de las tres condiciones falla.';

-- =============================================================================
-- 3. gd_kpi_ejecutivo — se agrega `flota_apta_circular`
-- =============================================================================
-- El panel ejecutivo y el modulo de flota deben publicar la misma cifra. Sin
-- esta columna, la portada diria 38 y el modulo 35 para la misma flota.
-- =============================================================================

DROP VIEW IF EXISTS public.gd_kpi_ejecutivo;

CREATE VIEW public.gd_kpi_ejecutivo AS
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
  -- Disponibilidad mecanica. Se conserva para no romper consumidores.
  (SELECT COUNT(*) FROM gannet_demo.vehiculos
    WHERE estado = 'operativo')                      AS flota_operativa,
  -- Aptitud legal para circular. Misma definicion que gd_flota_estado.
  (SELECT COUNT(*) FROM gannet_demo.vehiculos
    WHERE estado = 'operativo'
      AND (vtv_vence_el    IS NULL OR vtv_vence_el    >= CURRENT_DATE)
      AND (seguro_vence_el IS NULL OR seguro_vence_el >= CURRENT_DATE)) AS flota_apta_circular,
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
  'Fila unica con los indicadores de portada del panel ejecutivo: facturacion del mes y del ano en curso, cobranza pendiente y vencida, ordenes de trabajo abiertas y criticas, proyectos activos, tasa de conversion comercial, dotacion activa, flota y equipos. La flota se informa en dos cifras distintas: `flota_operativa` es disponibilidad mecanica y `flota_apta_circular` exige ademas verificacion tecnica y poliza vigentes. Todos los valores se recalculan contra la fecha actual en cada consulta.';

-- =============================================================================
-- 4. PRIVILEGIOS — obligatorio para toda vista recreada en `public`
-- =============================================================================
-- Ambas vistas acaban de nacer con ALL para `anon` por ALTER DEFAULT
-- PRIVILEGES. El REVOKE va primero; un GRANT SELECT solo no quita nada.
-- =============================================================================

REVOKE ALL ON public.gd_flota_estado  FROM anon, authenticated;
REVOKE ALL ON public.gd_kpi_ejecutivo FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.gd_flota_estado  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.gd_kpi_ejecutivo FROM anon, authenticated;

GRANT SELECT ON public.gd_flota_estado  TO anon, authenticated;
GRANT SELECT ON public.gd_kpi_ejecutivo TO anon, authenticated;

-- =============================================================================
-- 5. ASERCIONES DE CIERRE
-- Es preferible abortar el despliegue que dejar una vista escribible.
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
  -- Ninguna vista gd_* admite escritura desde los roles publicos.
  FOR r IN
    SELECT c.relname, rol, priv
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['anon','authenticated']) AS rol
    CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS priv
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname LIKE 'gd\_%'
      AND has_table_privilege(rol, c.oid, priv)
  LOOP
    RAISE EXCEPTION 'La vista public.% admite % para el rol %.', r.relname, r.priv, r.rol;
  END LOOP;

  -- Las dos vistas recreadas siguen siendo legibles: la demo corre sin sesion.
  IF NOT has_table_privilege('anon', 'public.gd_flota_estado', 'SELECT') THEN
    RAISE EXCEPTION 'anon perdio SELECT sobre public.gd_flota_estado.';
  END IF;
  IF NOT has_table_privilege('anon', 'public.gd_kpi_ejecutivo', 'SELECT') THEN
    RAISE EXCEPTION 'anon perdio SELECT sobre public.gd_kpi_ejecutivo.';
  END IF;

  -- Las tablas base permanecen inaccesibles para los roles publicos.
  FOR r IN
    SELECT c.relname, rol
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['anon','authenticated']) AS rol
    WHERE n.nspname = 'gannet_demo'
      AND c.relkind = 'r'
      AND has_table_privilege(rol, c.oid, 'SELECT')
  LOOP
    RAISE EXCEPTION
      'La tabla base gannet_demo.% es legible por el rol %.', r.relname, r.rol;
  END LOOP;
END $$;

-- Coherencia entre el KPI y la grilla: la portada y el modulo de flota deben
-- contar exactamente lo mismo.
DO $$
DECLARE
  kpi_apta  bigint;
  grid_apta bigint;
BEGIN
  SELECT flota_apta_circular INTO kpi_apta FROM public.gd_kpi_ejecutivo;
  SELECT COUNT(*) INTO grid_apta FROM public.gd_flota_estado WHERE apto_circular;

  IF kpi_apta IS DISTINCT FROM grid_apta THEN
    RAISE EXCEPTION
      'El KPI de flota (%) no coincide con la grilla (%).', kpi_apta, grid_apta;
  END IF;
END $$;

COMMIT;
