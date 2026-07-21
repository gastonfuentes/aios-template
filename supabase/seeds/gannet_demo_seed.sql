-- =============================================================================
-- SEMILLA DE DATOS — esquema `gannet_demo`
-- Andes Servicios Integrales S.A. — demo comercial para congreso minero
-- =============================================================================
--
-- QUE HACE
--   Puebla las 23 tablas transaccionales del esquema `gannet_demo` con
--   aproximadamente 27.000 registros coherentes entre si, que representan
--   dieciocho meses de operacion de una empresa proveedora multidisciplinaria
--   de la mineria argentina.
--
-- GARANTIAS
--   1. DETERMINISTA. No se usa random(), gen_random_uuid(), now() como fuente
--      de variacion ni ningun elemento no reproducible. Toda la aleatoriedad
--      aparente proviene de gannet_demo.sem_h(), una funcion hash md5 pura y
--      estable entre versiones y plataformas de PostgreSQL. Dos ejecuciones en
--      dos maquinas distintas producen datos identicos fila por fila.
--   2. SQL PURO. Se ejecuta con `psql -f`. Sin Node, Python ni extensiones.
--   3. FECHAS RELATIVAS. Toda fecha se deriva de CURRENT_DATE. La demo se ve
--      igual de fresca el dia que se corra.
--   4. IDEMPOTENTE. Comienza truncando las tablas de datos y reasigna claves
--      primarias explicitas. Correrlo N veces deja siempre el mismo estado.
--   5. COHERENCIA REFERENCIAL. Los recursos asignados a cada orden de trabajo
--      corresponden al servicio prestado, los importes de proyecto se derivan
--      de sus ordenes de trabajo y los estados son consistentes con las fechas.
--
-- IDENTIDAD DE LAS CLAVES
--   Las claves primarias se insertan explicitamente con OVERRIDING SYSTEM VALUE.
--   No se depende del orden de asignacion de las columnas IDENTITY, que no esta
--   garantizado bajo planes paralelos. Al final se reposicionan las secuencias.
--
-- REQUISITO PREVIO
--   La migracion 20260719000001_gannet_demo_schema.sql debe estar aplicada.
--   La tabla `servicios` NO se trunca: es dato de configuracion sembrado alli.
--
-- USO
--   psql "$DATABASE_URL" -f supabase/seeds/gannet_demo_seed.sql
--
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- La zona horaria se fija de forma explicita en UTC. Hay dos razones y ambas
-- importan para esta demo:
--   1. Determinismo. Sin fijarla, CURRENT_DATE y toda conversion de date a
--      timestamptz dependerian de la configuracion del servidor, y la copia
--      local del presentador podria generar datos distintos a los del VPS.
--   2. Coincidencia con la aplicacion. PostgreSQL y Supabase usan UTC por
--      defecto, de modo que el "hoy" que siembra este generador es exactamente
--      el mismo "hoy" que calculan las consultas de Mission Control. Fijar aqui
--      una zona local desplazaria el limite del dia respecto de la aplicacion y
--      el panel podria mostrar "sin actividad hoy" durante la presentacion.
SET LOCAL TimeZone = 'UTC';

-- =============================================================================
-- 0. PRIMITIVAS DE DETERMINISMO
-- =============================================================================
-- sem_h(n, sal) devuelve un entero estable en [0, 4294967295] a partir de un
-- indice de fila y una "sal" que identifica el atributo que se esta generando.
-- Es el unico origen de variacion del generador. Al depender de md5 sobre texto
-- ASCII, su resultado no varia entre plataformas, versiones ni ordenes de
-- ejecucion, a diferencia de setseed() + random(), cuya salida depende del
-- orden en que el planificador produce las filas.
-- =============================================================================

CREATE OR REPLACE FUNCTION gannet_demo.sem_h(n bigint, sal bigint)
RETURNS bigint
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT (('x' || substr(md5(n::text || ':' || sal::text), 1, 8))::bit(32)::int)::bigint
         + 2147483648;
$$;

COMMENT ON FUNCTION gannet_demo.sem_h(bigint, bigint) IS
  'Hash determinista del generador de demo. Devuelve un entero en [0, 4294967295] a partir de un indice de fila y una sal por atributo. Auxiliar de la semilla; se elimina al final del script.';

-- Fraccion determinista en [0, 1), en aritmetica numeric exacta.
CREATE OR REPLACE FUNCTION gannet_demo.sem_r(n bigint, sal bigint)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT gannet_demo.sem_h(n, sal)::numeric / 4294967296::numeric;
$$;

-- Entero determinista uniforme en [lo, hi].
CREATE OR REPLACE FUNCTION gannet_demo.sem_i(n bigint, sal bigint, lo integer, hi integer)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT lo + (gannet_demo.sem_h(n, sal) % (hi - lo + 1))::integer;
$$;

-- Numero determinista con decimales en [lo, hi], redondeado a `dec` decimales.
CREATE OR REPLACE FUNCTION gannet_demo.sem_n(n bigint, sal bigint, lo numeric, hi numeric, decimales integer)
RETURNS numeric
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT round(lo + (hi - lo) * gannet_demo.sem_r(n, sal), decimales);
$$;

-- =============================================================================
-- 1. LIMPIEZA — idempotencia
-- Se truncan las 23 tablas transaccionales. `servicios` queda intacta porque es
-- dato de configuracion cargado por la migracion del esquema.
-- =============================================================================

TRUNCATE TABLE
  gannet_demo.documentos,
  gannet_demo.actividades,
  gannet_demo.mantenimientos,
  gannet_demo.movimientos_stock,
  gannet_demo.orden_compra_items,
  gannet_demo.ordenes_compra,
  gannet_demo.proveedores,
  gannet_demo.facturas,
  gannet_demo.cotizacion_items,
  gannet_demo.cotizaciones,
  gannet_demo.turnos,
  gannet_demo.ot_asignaciones,
  gannet_demo.ordenes_trabajo,
  gannet_demo.proyectos,
  gannet_demo.stock,
  gannet_demo.articulos,
  gannet_demo.equipos,
  gannet_demo.vehiculos,
  gannet_demo.depositos,
  gannet_demo.contactos,
  gannet_demo.faenas,
  gannet_demo.clientes,
  gannet_demo.empleados
RESTART IDENTITY CASCADE;

-- Red de seguridad: si alguien trunco `servicios`, se repone el catalogo.
INSERT INTO gannet_demo.servicios (codigo, nombre, descripcion, unidad_facturacion) VALUES
  ('MANT_IND',   'Mantenimiento industrial',            'Mantenimiento preventivo y correctivo de instalaciones y maquinaria de planta.',        'hora'),
  ('OBRA_CIVIL', 'Obras civiles',                       'Ejecucion de obras de infraestructura: fundaciones, platea, caminos y estructuras.',    'global'),
  ('ELEC_IND',   'Electricidad industrial',             'Montaje, tendido y mantenimiento de instalaciones electricas de media y baja tension.', 'hora'),
  ('INST_AUTO',  'Instrumentación y automatización',    'Instalacion, calibracion y puesta en marcha de instrumentos y sistemas de control.',    'hora'),
  ('SOLD_MONT',  'Soldadura y montaje',                 'Soldadura calificada y montaje de estructuras metalicas, canerias y equipos.',          'jornada'),
  ('TRANS_LOG',  'Transporte y logística',              'Transporte de cargas, insumos y personal hacia y desde faena.',                         'km'),
  ('ALQ_MAQ',    'Alquiler de maquinaria y equipos',    'Provision de maquinaria y equipos en alquiler, con o sin operador.',                    'jornada'),
  ('MOV_SUELO',  'Movimiento de suelos',                'Excavacion, nivelacion, relleno y compactacion de terreno.',                            'm3'),
  ('SERV_CAMP',  'Servicios de campamento',             'Operacion de campamentos: alojamiento, comedor y servicios generales para el personal.','mes'),
  ('LIMP_IND',   'Limpieza industrial',                 'Limpieza tecnica de plantas, equipos, tanques y areas operativas.',                     'jornada')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================================================
-- 2. TABLAS AUXILIARES DE TRABAJO
-- Viven solo durante la sesion. Traducen los "indices logicos" que usa el
-- generador (servicio 1..10, faena n-esima del cliente, etc.) a las claves
-- reales, de modo que ninguna formula dependa de valores de id supuestos.
-- =============================================================================

DROP TABLE IF EXISTS tmp_srv;
CREATE TEMP TABLE tmp_srv AS
SELECT s.id, x.idx, s.codigo, s.nombre, s.unidad_facturacion
FROM gannet_demo.servicios s
JOIN unnest(ARRAY['MANT_IND','OBRA_CIVIL','ELEC_IND','INST_AUTO','SOLD_MONT',
                  'TRANS_LOG','ALQ_MAQ','MOV_SUELO','SERV_CAMP','LIMP_IND'])
     WITH ORDINALITY AS x(codigo, idx) ON x.codigo = s.codigo;

CREATE UNIQUE INDEX ON tmp_srv (idx);
CREATE UNIQUE INDEX ON tmp_srv (id);

-- -----------------------------------------------------------------------------
-- Calendario con estacionalidad. Traduce una fraccion en [0,1) a una fecha de
-- los ultimos 18 meses. Los pesos modelan tres efectos reales del negocio:
--   * estacionalidad minera argentina: caida en enero por vacaciones y en el
--     invierno puneño (junio-julio), pico en otoño y primavera;
--   * caida de actividad los fines de semana;
--   * crecimiento sostenido de la empresa hacia el presente.
-- Se usa aritmetica `numeric` exacta para que el reparto sea identico en
-- cualquier maquina, sin depender de la aritmetica de punto flotante.
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS tmp_calendario;
CREATE TEMP TABLE tmp_calendario AS
WITH dias AS (
  SELECT g AS atras, (CURRENT_DATE - g)::date AS fecha
  FROM generate_series(0, 545) AS g
),
pesos AS (
  SELECT
    atras,
    fecha,
    (ARRAY[0.55,0.80,1.15,1.25,1.20,0.72,0.68,0.95,1.20,1.32,1.24,0.85]::numeric[])
      [extract(month FROM fecha)::int]
    * (CASE extract(isodow FROM fecha)::int
         WHEN 6 THEN 0.40::numeric
         WHEN 7 THEN 0.18::numeric
         ELSE 1.00::numeric END)
    * (1.00::numeric + 0.60::numeric * (545 - atras)::numeric / 545::numeric)
      AS peso
  FROM dias
)
SELECT
  atras,
  fecha,
  peso,
  (SUM(peso) OVER (ORDER BY atras DESC ROWS UNBOUNDED PRECEDING) - peso)
    / SUM(peso) OVER () AS lo,
  SUM(peso) OVER (ORDER BY atras DESC ROWS UNBOUNDED PRECEDING)
    / SUM(peso) OVER () AS hi
FROM pesos;

CREATE INDEX ON tmp_calendario (lo, hi);

-- -----------------------------------------------------------------------------
-- Reparto de Pareto de la cartera de clientes. Los pesos estan escritos a mano
-- en vez de derivarse de una potencia fraccionaria para que el reparto sea
-- exacto y auditable: los seis clientes nombrados concentran cerca del 61% de
-- la actividad y los diez mas chicos apenas el 6%.
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS tmp_peso_cliente;
CREATE TEMP TABLE tmp_peso_cliente AS
WITH w(cliente_id, peso) AS (
  VALUES (1,180),(2,150),(3,130),(4,95),(5,85),(6,75),
         (7,48),(8,44),(9,40),(10,36),(11,33),(12,30),
         (13,26),(14,24),(15,22),(16,20),(17,18),(18,16),(19,15),(20,14),
         (21,12),(22,11),(23,10),(24,9),(25,8),(26,7),(27,6),(28,5),(29,4),(30,3)
)
SELECT
  cliente_id,
  (SUM(peso) OVER (ORDER BY cliente_id ROWS UNBOUNDED PRECEDING) - peso)::numeric
    / SUM(peso) OVER ()::numeric AS lo,
  SUM(peso) OVER (ORDER BY cliente_id ROWS UNBOUNDED PRECEDING)::numeric
    / SUM(peso) OVER ()::numeric AS hi
FROM w;

CREATE INDEX ON tmp_peso_cliente (lo, hi);

-- -----------------------------------------------------------------------------
-- Reparto de servicios. El mantenimiento industrial y el transporte son el
-- grueso del volumen; los servicios de campamento, el nicho.
-- -----------------------------------------------------------------------------

DROP TABLE IF EXISTS tmp_peso_servicio;
CREATE TEMP TABLE tmp_peso_servicio AS
WITH w(idx, peso) AS (
  VALUES (1,240),(2,120),(3,110),(4,55),(5,105),(6,150),(7,70),(8,80),(9,30),(10,40)
)
SELECT
  idx,
  (SUM(peso) OVER (ORDER BY idx ROWS UNBOUNDED PRECEDING) - peso)::numeric
    / SUM(peso) OVER ()::numeric AS lo,
  SUM(peso) OVER (ORDER BY idx ROWS UNBOUNDED PRECEDING)::numeric
    / SUM(peso) OVER ()::numeric AS hi
FROM w;

CREATE INDEX ON tmp_peso_servicio (lo, hi);

-- =============================================================================
-- 3. empleados — 140 personas con organigrama real
-- =============================================================================
-- Bloques de identidad, usados despues por las formulas de asignacion:
--     1          Director General
--     2 .. 8     Gerentes de area (operaciones, mantenimiento, logistica,
--                administracion, comercial, seguridad e higiene, deposito)
--     9 .. 28    Jefes tecnicos, dos por cada uno de los diez servicios
--    29 .. 30    Jefe de Administracion y Jefe Comercial
--    31 ..130    Personal operativo, diez por cada servicio
--   131 ..140    Soporte comercial, administrativo, de deposito y de seguridad
--
-- El empleado operativo del servicio S ocupa los id  31 + (S-1) + 10*k,
-- con k entre 0 y 9. Esa regla permite elegir cuadrillas idoneas para cada
-- orden de trabajo con aritmetica pura, sin recorrer la tabla.
-- =============================================================================

INSERT INTO gannet_demo.empleados (
  id, legajo, nombre, apellido, documento, puesto, area, especialidad_servicio_id,
  supervisor_id, modalidad_turno, fecha_ingreso, costo_hora_ars, email, telefono, estado
)
OVERRIDING SYSTEM VALUE
SELECT
  e.i,
  'AND-' || lpad(e.i::text, 4, '0'),
  e.nombre,
  e.apellido,
  (20000000 + gannet_demo.sem_h(e.i, 105) % 25000000)::text,
  e.puesto,
  e.area,
  s.id,
  e.supervisor_id,
  e.modalidad,
  (CURRENT_DATE - e.antiguedad)::date,
  e.costo_hora,
  translate(lower(e.nombre), 'áéíóúüñ', 'aeiouun') || '.'
    || translate(lower(e.apellido), 'áéíóúüñ', 'aeiouun') || '@andesservicios.com.ar',
  '+54 9 ' || (ARRAY['387','388','383','264','297','261'])[1 + gannet_demo.sem_h(e.i, 108) % 6]
    || ' ' || lpad((gannet_demo.sem_h(e.i, 109) % 10000000)::text, 7, '0'),
  e.estado
FROM (
  SELECT
    b.i,
    b.nivel,
    b.srv_idx,
    b.area,
    (ARRAY['Rodrigo','Martín','Sebastián','Gonzalo','Facundo','Lucas','Nicolás','Emiliano',
           'Hernán','Mauricio','Damián','Leandro','Federico','Gustavo','Marcelo','Alejandro',
           'Diego','Ramiro','Ignacio','Matías','Julieta','Carolina','Valeria','Soledad',
           'Mariana','Paula','Cecilia','Analía','Verónica','Romina','Silvina','Natalia',
           'Ezequiel','Cristian','Walter','Osvaldo','Rubén','Horacio','Norberto','Aníbal'])
      [1 + gannet_demo.sem_h(b.i, 101) % 40] AS nombre,
    (ARRAY['Quiroga','Villalba','Sosa','Gutiérrez','Molina','Ferreyra','Ledesma','Vera',
           'Peralta','Cabrera','Ojeda','Ríos','Coronel','Aguirre','Maidana','Barrientos',
           'Zalazar','Nieva','Cardozo','Chávez','Bustos','Ponce','Alderete','Farías',
           'Romero','Gómez','Fernández','Rodríguez','Luna','Ibáñez','Toledo','Arias',
           'Paz','Herrera','Roldán','Miranda','Palacios','Guzmán','Cáceres','Acosta',
           'Cruz','Vargas','Mansilla','Escobar','Britos','Olmos','Tapia','Reinoso',
           'Carrizo','Agüero','Correa','Sarmiento','Colque','Mamaní','Choque','Yapura',
           'Flores','Condorí','Cañizares','Zerpa'])
      [1 + gannet_demo.sem_h(b.i, 102) % 60] AS apellido,
    CASE b.nivel
      WHEN 'director' THEN 'Director General'
      WHEN 'gerente'  THEN 'Gerente de ' ||
        (ARRAY['Operaciones','Mantenimiento','Logística','Administración y Finanzas',
               'Desarrollo Comercial','Seguridad e Higiene','Abastecimiento'])[b.i - 1]
      WHEN 'jefe' THEN
        CASE
          WHEN b.i = 29 THEN 'Jefe de Administración'
          WHEN b.i = 30 THEN 'Jefe Comercial'
          ELSE 'Jefe de ' ||
            (ARRAY['Mantenimiento Industrial','Obras Civiles','Electricidad Industrial',
                   'Instrumentación y Automatización','Soldadura y Montaje',
                   'Transporte y Logística','Alquiler de Maquinaria','Movimiento de Suelos',
                   'Servicios de Campamento','Limpieza Industrial'])[b.srv_idx]
        END
      WHEN 'operativo' THEN
        (ARRAY['Técnico Mecánico','Oficial Albañil','Electricista Industrial',
               'Técnico Instrumentista','Soldador Calificado','Chofer Profesional',
               'Operador de Equipo Pesado','Maquinista Vial','Auxiliar de Campamento',
               'Operario de Limpieza Técnica'])[b.srv_idx]
      ELSE
        (ARRAY['Ejecutivo de Cuenta','Ejecutivo de Cuenta','Analista Comercial',
               'Analista Administrativo','Liquidador de Sueldos','Analista de Cobranzas',
               'Pañolero','Encargado de Depósito','Técnico en Seguridad e Higiene',
               'Analista HSE'])[b.i - 130]
    END AS puesto,
    CASE
      WHEN b.i = 1 THEN NULL::bigint
      WHEN b.i BETWEEN 2 AND 8 THEN 1::bigint
      WHEN b.i = 29 THEN 5::bigint
      WHEN b.i = 30 THEN 6::bigint
      WHEN b.nivel = 'jefe' THEN
        (ARRAY[3,2,3,3,2,4,4,2,2,2])[b.srv_idx]::bigint
      WHEN b.nivel = 'operativo' THEN
        (9 + (b.srv_idx - 1) + 10 * (gannet_demo.sem_h(b.i, 103) % 2))::bigint
      WHEN b.i BETWEEN 131 AND 133 THEN 30::bigint
      WHEN b.i BETWEEN 134 AND 136 THEN 29::bigint
      WHEN b.i BETWEEN 137 AND 138 THEN 8::bigint
      ELSE 7::bigint
    END AS supervisor_id,
    CASE
      WHEN b.nivel IN ('director','gerente') THEN 'jornada'
      WHEN b.nivel = 'jefe' THEN (ARRAY['7x7','14x14','jornada','4x3'])[1 + gannet_demo.sem_h(b.i, 104) % 4]
      WHEN b.nivel = 'operativo' THEN (ARRAY['4x3','7x7','14x14','guardia'])[1 + gannet_demo.sem_h(b.i, 104) % 4]
      ELSE 'jornada'
    END AS modalidad,
    CASE b.nivel
      WHEN 'director'  THEN 4380
      WHEN 'gerente'   THEN 2400 + (gannet_demo.sem_h(b.i, 106) % 1500)::int
      WHEN 'jefe'      THEN 1100 + (gannet_demo.sem_h(b.i, 106) % 1900)::int
      WHEN 'operativo' THEN   45 + (gannet_demo.sem_h(b.i, 106) % 2300)::int
      ELSE                   200 + (gannet_demo.sem_h(b.i, 106) % 2000)::int
    END AS antiguedad,
    CASE b.nivel
      WHEN 'director'  THEN 86000.00::numeric
      WHEN 'gerente'   THEN gannet_demo.sem_n(b.i, 107, 51000, 66000, 2)
      WHEN 'jefe'      THEN gannet_demo.sem_n(b.i, 107, 28500, 38500, 2)
      WHEN 'operativo' THEN gannet_demo.sem_n(b.i, 107, 11500, 21000, 2)
      ELSE                  gannet_demo.sem_n(b.i, 107, 14000, 23000, 2)
    END AS costo_hora,
    CASE
      WHEN b.i <= 8 OR b.i >= 131 THEN 'activo'
      WHEN gannet_demo.sem_h(b.i, 110) % 100 < 4  THEN 'licencia'
      WHEN gannet_demo.sem_h(b.i, 110) % 100 < 6  THEN 'suspendido'
      WHEN gannet_demo.sem_h(b.i, 110) % 100 < 10 THEN 'baja'
      ELSE 'activo'
    END AS estado
  FROM (
    SELECT
      a.i,
      a.nivel,
      a.srv_idx,
      CASE
        WHEN a.i = 1 THEN 'direccion'
        WHEN a.i BETWEEN 2 AND 8 THEN
          (ARRAY['operaciones','mantenimiento','logistica','administracion',
                 'comercial','seguridad_higiene','deposito'])[a.i - 1]
        WHEN a.i = 29 THEN 'administracion'
        WHEN a.i = 30 THEN 'comercial'
        WHEN a.srv_idx IS NOT NULL THEN
          (ARRAY['mantenimiento','operaciones','mantenimiento','mantenimiento','operaciones',
                 'logistica','logistica','operaciones','operaciones','operaciones'])[a.srv_idx]
        WHEN a.i BETWEEN 131 AND 133 THEN 'comercial'
        WHEN a.i BETWEEN 134 AND 136 THEN 'administracion'
        WHEN a.i BETWEEN 137 AND 138 THEN 'deposito'
        ELSE 'seguridad_higiene'
      END AS area
    FROM (
      SELECT
        g.i,
        CASE
          WHEN g.i = 1 THEN 'director'
          WHEN g.i BETWEEN 2 AND 8 THEN 'gerente'
          WHEN g.i BETWEEN 9 AND 30 THEN 'jefe'
          WHEN g.i BETWEEN 31 AND 130 THEN 'operativo'
          ELSE 'soporte'
        END AS nivel,
        CASE
          WHEN g.i BETWEEN 9 AND 28 THEN ((g.i - 9) % 10) + 1
          WHEN g.i BETWEEN 31 AND 130 THEN ((g.i - 31) % 10) + 1
          ELSE NULL
        END AS srv_idx
      FROM generate_series(1, 140) AS g(i)
    ) a
  ) b
) e
LEFT JOIN tmp_srv s ON s.idx = e.srv_idx;

-- =============================================================================
-- 4. clientes — 30 companias, seis nombradas en el documento de la demo
-- =============================================================================

INSERT INTO gannet_demo.clientes (
  id, razon_social, nombre_comercial, cuit, mineral_principal, provincia, localidad,
  ejecutivo_cuenta_id, estado, condicion_pago_dias, limite_credito_ars, fecha_alta, sitio_web
)
OVERRIDING SYSTEM VALUE
SELECT
  c.id,
  c.razon_social,
  c.comercial,
  '30-' || (70000000 + gannet_demo.sem_h(c.id, 201) % 9000000)::text
        || '-' || (gannet_demo.sem_h(c.id, 202) % 10)::text,
  c.mineral,
  c.provincia,
  c.localidad,
  (ARRAY[6, 30, 131, 132, 133])[1 + gannet_demo.sem_h(c.id, 203) % 5]::bigint,
  c.estado,
  (ARRAY[30, 45, 60, 60, 90])[1 + gannet_demo.sem_h(c.id, 204) % 5],
  round(gannet_demo.sem_n(c.id, 205, 0.6, 1.4, 4) * c.credito_base, 2),
  (CURRENT_DATE - (280 + gannet_demo.sem_h(c.id, 206) % 2900)::int)::date,
  'https://www.' || c.slug || '.com.ar'
FROM (
  VALUES
    ( 1,'Litio del Norte S.A.',                  'Litio del Norte',      'litiodelnorte',    'litio',  'Jujuy',       'Susques',            'activo',    2800000000::numeric),
    ( 2,'Puna Minerals S.A.',                    'Puna Minerals',        'punaminerals',     'litio',  'Salta',       'San Antonio de los Cobres','activo',2400000000::numeric),
    ( 3,'Altos Andes Mining S.A.',               'Altos Andes',          'altosandes',       'cobre',  'San Juan',    'Iglesia',            'activo',    2100000000::numeric),
    ( 4,'Sal de los Andes S.A.',                 'Sal de los Andes',     'saldelosandes',    'sal',    'Catamarca',   'Antofagasta de la Sierra','moroso',1500000000::numeric),
    ( 5,'Cordillera Lithium S.A.',               'Cordillera Lithium',   'cordilleralithium','litio',  'Salta',       'Salta',              'activo',    1400000000::numeric),
    ( 6,'Andean Copper S.A.',                    'Andean Copper',        'andeancopper',     'cobre',  'San Juan',    'Calingasta',         'activo',    1300000000::numeric),
    ( 7,'Minera Sierra Grande del Norte S.A.',   'Sierra Grande Norte',  'sierragrandenorte','oro',    'Santa Cruz',  'Perito Moreno',      'activo',     900000000::numeric),
    ( 8,'Boratos Andinos S.A.',                  'Boratos Andinos',      'boratosandinos',   'borato', 'Salta',       'Tolar Grande',       'activo',     820000000::numeric),
    ( 9,'Potasio Cuyano S.A.',                   'Potasio Cuyano',       'potasiocuyano',    'potasio','Mendoza',     'Malargüe',           'activo',     780000000::numeric),
    (10,'Aurífera Famatina S.A.',                'Aurífera Famatina',    'auriferafamatina', 'oro',    'La Rioja',    'Chilecito',          'activo',     700000000::numeric),
    (11,'Plata del Oeste S.A.',                  'Plata del Oeste',      'platadeloeste',    'plata',  'Chubut',      'Gastre',             'activo',     640000000::numeric),
    (12,'Cobre Patagónico S.A.',                 'Cobre Patagónico',     'cobrepatagonico',  'cobre',  'Chubut',      'Telsen',             'activo',     600000000::numeric),
    (13,'Salares del Altiplano S.A.',            'Salares del Altiplano','salaresaltiplano', 'litio',  'Jujuy',       'Rinconada',          'activo',     520000000::numeric),
    (14,'Minera Los Menucos S.A.',               'Los Menucos',          'losmenucos',       'otro',   'Río Negro',   'Los Menucos',        'activo',     480000000::numeric),
    (15,'Litio Puneño S.A.',                     'Litio Puneño',         'litiopuneno',      'litio',  'Catamarca',   'Antofagasta de la Sierra','activo',450000000::numeric),
    (16,'Andes Gold Resources S.A.',             'Andes Gold',           'andesgold',        'oro',    'San Juan',    'Jáchal',             'activo',     420000000::numeric),
    (17,'Compañía Minera Vinchina S.A.',         'Minera Vinchina',      'mineravinchina',   'oro',    'La Rioja',    'Vinchina',           'inactivo',   380000000::numeric),
    (18,'Uspallata Metals S.A.',                 'Uspallata Metals',     'uspallatametals',  'cobre',  'Mendoza',     'Uspallata',          'activo',     350000000::numeric),
    (19,'Cateo Norte Exploraciones S.A.',        'Cateo Norte',          'cateonorte',       'otro',   'Jujuy',       'Abra Pampa',         'activo',     320000000::numeric),
    (20,'Salinas Grandes Lithium S.A.',          'Salinas Grandes Li',   'salinasgrandesli', 'litio',  'Jujuy',       'Tumbaya',            'activo',     300000000::numeric),
    (21,'Minera Cerro Bayo Argentina S.A.',      'Cerro Bayo Argentina', 'cerrobayoarg',     'plata',  'Santa Cruz',  'Gobernador Gregores','activo',     260000000::numeric),
    (22,'Boratos del Rincón S.A.',               'Boratos del Rincón',   'boratosdelrincon', 'borato', 'Salta',       'Salta',              'activo',     240000000::numeric),
    (23,'Metalífera Andina S.A.',                'Metalífera Andina',    'metaliferaandina', 'cobre',  'Catamarca',   'Belén',              'prospecto',  200000000::numeric),
    (24,'Oro y Plata Cuyo S.A.',                 'Oro y Plata Cuyo',     'oroyplatacuyo',    'oro',    'San Juan',    'Rodeo',              'activo',     180000000::numeric),
    (25,'Minera Antofalla Norte S.A.',           'Antofalla Norte',      'antofallanorte',   'litio',  'Catamarca',   'Antofalla',          'activo',     160000000::numeric),
    (26,'Litio Salar Blanco Norte S.A.',         'Salar Blanco Norte',   'salarblanconorte', 'litio',  'Salta',       'Pocitos',            'prospecto',  140000000::numeric),
    (27,'Minera Agua Negra S.A.',                'Agua Negra',           'mineraaguanegra',  'cobre',  'San Juan',    'Iglesia',            'activo',     120000000::numeric),
    (28,'Cordón del Plata Minerales S.A.',       'Cordón del Plata',     'cordondelplata',   'plata',  'Mendoza',     'Tupungato',          'inactivo',   100000000::numeric),
    (29,'Energía Andina Generación S.A.',        'Energía Andina',       'energiaandina',    'otro',   'Salta',       'Salta',              'activo',      90000000::numeric),
    (30,'Cementos del Valle S.A.',               'Cementos del Valle',   'cementosdelvalle', 'otro',   'Catamarca',   'Catamarca',          'prospecto',   80000000::numeric)
) AS c(id, razon_social, comercial, slug, mineral, provincia, localidad, estado, credito_base);

-- =============================================================================
-- 5. faenas — 60 emplazamientos
-- Los clientes grandes (1 a 8) tienen tres faenas; los medianos (9 a 22), dos;
-- los chicos (23 a 30), una. Cada nombre de yacimiento se usa una sola vez, lo
-- que satisface por construccion la unicidad (cliente_id, nombre).
-- =============================================================================

INSERT INTO gannet_demo.faenas (
  id, cliente_id, nombre, tipo, provincia, altitud_msnm, latitud, longitud, activa
)
OVERRIDING SYSTEM VALUE
SELECT
  f.j,
  f.cliente_id,
  (CASE f.tipo
     WHEN 'mina'       THEN 'Mina '
     WHEN 'planta'     THEN 'Planta '
     WHEN 'salar'      THEN 'Salar '
     WHEN 'campamento' THEN 'Campamento '
     WHEN 'puerto'     THEN 'Puerto '
     ELSE 'Depósito '
   END) ||
  (ARRAY['Antofalla Norte','Rincón Blanco','Quebrada del Toro','Cerro Amarillo','Vega Grande',
         'Pastos Chicos','Cauchari Sur','Olacapato','Tres Morros','Loma Negra Alta',
         'Salar del Diablo','Chuculaqui','Sierra Nevada Sur','Agua Caliente','Punta del Agua',
         'El Peñón Alto','Cerro Overo','La Ciénaga','Río Grande Oeste','Barrancas Blancas',
         'Aguas Calientes Norte','Cerro Colorado','Vicuña Muerta','Tolar Grande Sur','Arizaro Este',
         'Pocitos Norte','Hombre Muerto Este','Antuco Alto','Los Patos Sur','Guanaco Sonso',
         'Piedra Parada','Cerro Bayo Norte','La Angostura Alta','Molinos Altos','Cachi Adentro',
         'Yacoraite','Purmamarca Norte','Cerro Aguilar Sur','Cerro Redondo','Laguna Verde Alta',
         'Paso del Cura','El Salvador Norte','Cordón Blanco','Los Azules Sur','Portezuelo Ancho',
         'Río Blanco Alto','Valle Fértil Norte','Cuesta del Viento','Iglesia Alta','Calingasta Sur',
         'Meseta Austral','Cañadón Largo','Bajo Caracoles Norte','Meseta del Guenguel','Deseado Sur',
         'La Josefina Alta','Río Chico Oeste','Sierra Colorada','Meseta de Somuncurá','Cerro Ventana'])
    [f.j] AS nombre,
  f.tipo,
  cl.provincia,
  f.altitud,
  round(f.lat, 6),
  round(f.lon, 6),
  (gannet_demo.sem_h(f.j, 310) % 100) >= 8
FROM (
  SELECT
    j,
    cliente_id,
    n,
    CASE
      WHEN mineral = 'litio' AND n = 1 THEN 'salar'
      WHEN mineral = 'sal'   AND n = 1 THEN 'salar'
      WHEN n = 1 THEN 'mina'
      WHEN n = 2 THEN 'planta'
      ELSE (ARRAY['campamento','deposito','mina','puerto'])[1 + gannet_demo.sem_h(j, 301) % 4]
    END AS tipo,
    CASE
      WHEN mineral IN ('litio','sal','borato') THEN 3300 + (gannet_demo.sem_h(j, 302) % 1100)::int
      ELSE 900 + (gannet_demo.sem_h(j, 302) % 3200)::int
    END AS altitud,
    -22.0::numeric - gannet_demo.sem_n(j, 303, 0, 28, 6) AS lat,
    -65.0::numeric - gannet_demo.sem_n(j, 304, 0, 6, 6)  AS lon,
    mineral
  FROM (
    SELECT
      row_number() OVER (ORDER BY x.cliente_id, x.n) AS j,
      x.cliente_id,
      x.n,
      x.mineral
    FROM (
      SELECT c.id AS cliente_id, gs.n, c.mineral_principal AS mineral
      FROM gannet_demo.clientes c
      CROSS JOIN LATERAL generate_series(
        1,
        CASE WHEN c.id <= 8 THEN 3 WHEN c.id <= 22 THEN 2 ELSE 1 END
      ) AS gs(n)
    ) x
  ) y
) f
JOIN gannet_demo.clientes cl ON cl.id = f.cliente_id;

-- Indice logico de faenas por cliente: permite elegir "la n-esima faena del
-- cliente C" con una simple igualdad, sin depender de rangos de id calculados.
DROP TABLE IF EXISTS tmp_faena;
CREATE TEMP TABLE tmp_faena AS
SELECT
  id AS faena_id,
  cliente_id,
  row_number() OVER (PARTITION BY cliente_id ORDER BY id) AS n,
  count(*)     OVER (PARTITION BY cliente_id)             AS total
FROM gannet_demo.faenas;

CREATE UNIQUE INDEX ON tmp_faena (cliente_id, n);
CREATE UNIQUE INDEX ON tmp_faena (faena_id);

-- =============================================================================
-- 6. contactos — 120, cuatro por cliente, uno principal
-- =============================================================================

INSERT INTO gannet_demo.contactos (
  id, cliente_id, faena_id, nombre, apellido, cargo, area, email, telefono, es_principal, activo
)
OVERRIDING SYSTEM VALUE
SELECT
  k.j,
  k.cliente_id,
  fa.faena_id,
  k.nombre,
  k.apellido,
  k.cargo,
  k.area,
  translate(lower(k.nombre), 'áéíóúüñ', 'aeiouun') || '.'
    || translate(lower(k.apellido), 'áéíóúüñ', 'aeiouun') || '@' || k.slug || '.com.ar',
  '+54 9 ' || (ARRAY['387','388','383','264','297','261'])[1 + gannet_demo.sem_h(k.j, 408) % 6]
    || ' ' || lpad((gannet_demo.sem_h(k.j, 409) % 10000000)::text, 7, '0'),
  (k.n = 1),
  (gannet_demo.sem_h(k.j, 410) % 100) >= 7
FROM (
  SELECT
    (c.id - 1) * 4 + gs.n AS j,
    c.id AS cliente_id,
    gs.n,
    replace(replace(lower(c.nombre_comercial), ' ', ''), '.', '') AS slug,
    (ARRAY['Marcela','Fernando','Adriana','Pablo','Silvia','Jorge','Laura','Esteban',
           'Patricia','Alberto','Andrea','Raúl','Claudia','Enrique','Mónica','Oscar',
           'Gabriela','Sergio','Liliana','Daniel'])
      [1 + gannet_demo.sem_h((c.id - 1) * 4 + gs.n, 401) % 20] AS nombre,
    (ARRAY['Benítez','Salazar','Medina','Ávalos','Godoy','Suárez','Rivero','Ortiz',
           'Pereyra','Domínguez','Navarro','Iglesias','Almirón','Bazán','Segovia','Lucero',
           'Moyano','Ruiz Díaz','Bianchi','Costilla','Aramayo','Torino','Cornejo','Figueroa'])
      [1 + gannet_demo.sem_h((c.id - 1) * 4 + gs.n, 402) % 24] AS apellido,
    (ARRAY['Gerente de Contratos','Jefe de Mantenimiento','Comprador Senior',
           'Superintendente de Operaciones'])[gs.n] AS cargo,
    (ARRAY['contratos','mantenimiento','compras','operaciones'])[gs.n] AS area
  FROM gannet_demo.clientes c
  CROSS JOIN generate_series(1, 4) AS gs(n)
) k
LEFT JOIN tmp_faena fa
  ON fa.cliente_id = k.cliente_id
 AND k.n > 1
 AND fa.n = 1 + gannet_demo.sem_h(k.j, 403) % fa.total;

-- Indice logico de contactos por cliente.
DROP TABLE IF EXISTS tmp_contacto;
CREATE TEMP TABLE tmp_contacto AS
SELECT
  id AS contacto_id,
  cliente_id,
  row_number() OVER (PARTITION BY cliente_id ORDER BY id) AS n,
  count(*)     OVER (PARTITION BY cliente_id)             AS total
FROM gannet_demo.contactos;

CREATE UNIQUE INDEX ON tmp_contacto (cliente_id, n);

-- =============================================================================
-- 7. depositos — 8 almacenes
-- =============================================================================

INSERT INTO gannet_demo.depositos (id, nombre, tipo, faena_id, direccion, responsable_id, activo)
OVERRIDING SYSTEM VALUE
SELECT
  d.id, d.nombre, d.tipo,
  CASE WHEN d.tipo = 'faena' THEN fa.faena_id ELSE NULL END,
  d.direccion, d.responsable_id, true
FROM (
  VALUES
    (1,'Depósito Central Salta',        'central', NULL::int, NULL::int, 'Parque Industrial Salta, Av. Circunvalación Norte 2450, Salta',   8::bigint),
    (2,'Depósito Central San Juan',     'central', NULL,      NULL,      'Parque Industrial Chimbas, Calle 5 s/n, San Juan',              137::bigint),
    (3,'Pañol Faena Litio del Norte',   'faena',   1,         1,         'Interior faena, sector servicios a terceros',                   138::bigint),
    (4,'Pañol Faena Puna Minerals',     'faena',   2,         1,         'Interior faena, sector contratistas',                           140::bigint),
    (5,'Pañol Faena Altos Andes',       'faena',   3,         1,         'Interior faena, playa de maniobras',                            137::bigint),
    (6,'Pañol Faena Cordillera Lithium','faena',   5,         1,         'Interior faena, sector almacenes',                              138::bigint),
    (7,'Pañol Faena Andean Copper',     'faena',   6,         1,         'Interior faena, sector mantenimiento',                          140::bigint),
    (8,'Depósito Móvil Puna',           'movil',   NULL,      NULL,      'Contenedor 40 pies, itinerante entre faenas de altura',           4::bigint)
) AS d(id, nombre, tipo, cliente_ref, faena_n, direccion, responsable_id)
LEFT JOIN tmp_faena fa ON fa.cliente_id = d.cliente_ref AND fa.n = d.faena_n;

-- =============================================================================
-- 8. vehiculos — 45 unidades
-- La flota se ordena en bloques de id por tipo, de modo que las ordenes de
-- trabajo puedan elegir un vehiculo apto para el servicio con aritmetica pura:
--    1 .. 12  camioneta        23 .. 28  tractor_semi     39 .. 40  grua
--   13 .. 22  camion           29 .. 32  minibus          41 .. 42  hormigonera
--   33 .. 38  utilitario       43 .. 44  cisterna         45        ambulancia
-- =============================================================================

INSERT INTO gannet_demo.vehiculos (
  id, dominio, tipo, marca, modelo, anio, km_actual, estado, responsable_id,
  deposito_base_id, vtv_vence_el, seguro_vence_el, costo_km_ars, valor_ars
)
OVERRIDING SYSTEM VALUE
SELECT
  v.i,
  (ARRAY['A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S','T','V'])
    [1 + gannet_demo.sem_h(v.i, 601) % 18]
  || (ARRAY['A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S','T','V'])
    [1 + gannet_demo.sem_h(v.i, 602) % 18]
  || lpad((100 + v.i)::text, 3, '0')
  || (ARRAY['A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S','T','V'])
    [1 + gannet_demo.sem_h(v.i, 603) % 18]
  || (ARRAY['A','B','C','D','E','F','G','H','J','K','L','M','N','P','R','S','T','V'])
    [1 + gannet_demo.sem_h(v.i, 604) % 18] AS dominio,
  v.tipo,
  split_part(v.marca_modelo, '|', 1) AS marca,
  split_part(v.marca_modelo, '|', 2) AS modelo,
  2016 + (gannet_demo.sem_h(v.i, 605) % 10)::int,
  v.km_base + (gannet_demo.sem_h(v.i, 606) % 180000)::int,
  v.estado,
  resp.id,
  v.deposito,
  -- Un vehiculo con la verificacion tecnica vencida: senal deliberada para el
  -- panel de alertas de flota.
  CASE WHEN v.i = 17 THEN (CURRENT_DATE - 47)
       ELSE (CURRENT_DATE + gannet_demo.sem_i(v.i, 607, -25, 400))::date END,
  (CURRENT_DATE + gannet_demo.sem_i(v.i, 608, 15, 380))::date,
  v.costo_km,
  v.valor
FROM (
  SELECT
    g.i,
    CASE
      WHEN g.i <= 12 THEN 'camioneta'   WHEN g.i <= 22 THEN 'camion'
      WHEN g.i <= 28 THEN 'tractor_semi' WHEN g.i <= 32 THEN 'minibus'
      WHEN g.i <= 38 THEN 'utilitario'  WHEN g.i <= 40 THEN 'grua'
      WHEN g.i <= 42 THEN 'hormigonera' WHEN g.i <= 44 THEN 'cisterna'
      ELSE 'ambulancia'
    END AS tipo,
    -- Brand and model are drawn as ONE indivisible pair, never as two
    -- independent draws. Drawing them separately produced impossible units
    -- ("Volvo Atego", "Grove Arocs"), which any fleet manager spots at a
    -- glance and reads as proof that the whole dataset is fabricated.
    -- The catalogue below is restricted to units actually sold and operated
    -- in Argentine mining service fleets, and each pair belongs together.
    -- Encoded as 'brand|model' and split in the outer SELECT so the pair can
    -- never be broken by a later edit.
    CASE
      -- 1..12 camioneta — pickups
      WHEN g.i <= 12 THEN (ARRAY[
        'Toyota|Hilux 4x4 DC',
        'Ford|Ranger 4x4 DC',
        'Volkswagen|Amarok V6 4x4',
        'Nissan|Frontier 4x4'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 4]
      -- 13..22 camion — rigid trucks
      WHEN g.i <= 22 THEN (ARRAY[
        'Mercedes-Benz|Atego 1726',
        'Iveco|Tector 240E28',
        'Scania|P360 6x4',
        'Volvo|VM 330',
        'Ford|Cargo 1723',
        'Volkswagen|Constellation 17.280'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 6]
      -- 23..28 tractor_semi — road tractors
      WHEN g.i <= 28 THEN (ARRAY[
        'Scania|R450 6x2',
        'Volvo|FH 460',
        'Iveco|Stralis 480',
        'Mercedes-Benz|Actros 2045'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 4]
      -- 29..32 minibus — crew transport
      WHEN g.i <= 32 THEN (ARRAY[
        'Mercedes-Benz|Sprinter 21+1',
        'Iveco|Daily 50C17'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 2]
      -- 33..38 utilitario — light vans
      WHEN g.i <= 38 THEN (ARRAY[
        'Renault|Kangoo Furgón',
        'Fiat|Fiorino Fire',
        'Peugeot|Partner Confort'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 3]
      -- 39..40 grua — cranes
      WHEN g.i <= 40 THEN (ARRAY[
        'Grove|RT540E',
        'Palfinger|PK 23002'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 2]
      -- 41..42 hormigonera — concrete mixers
      WHEN g.i <= 42 THEN (ARRAY[
        'Mercedes-Benz|Arocs 3345',
        'Iveco|Trakker 380'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 2]
      -- 43..44 cisterna — tankers
      WHEN g.i <= 44 THEN (ARRAY[
        'Scania|G410 6x4',
        'Ford|Cargo 1729'
      ])[1 + gannet_demo.sem_h(g.i, 609) % 2]
      -- 45 ambulancia
      ELSE 'Mercedes-Benz|Sprinter 415'
    END AS marca_modelo,
    CASE WHEN g.i <= 12 THEN 40000 WHEN g.i <= 32 THEN 120000 ELSE 25000 END AS km_base,
    CASE
      WHEN gannet_demo.sem_h(g.i, 611) % 100 < 9  THEN 'en_mantenimiento'
      WHEN gannet_demo.sem_h(g.i, 611) % 100 < 13 THEN 'fuera_servicio'
      WHEN gannet_demo.sem_h(g.i, 611) % 100 < 15 THEN 'baja'
      ELSE 'operativo'
    END AS estado,
    1 + gannet_demo.sem_h(g.i, 612) % 8 AS deposito,
    CASE
      WHEN g.i <= 12 THEN 'comercial'
      WHEN g.i <= 32 OR g.i BETWEEN 43 AND 44 THEN 'logistica'
      WHEN g.i <= 38 THEN 'administracion'
      WHEN g.i <= 42 THEN 'operaciones'
      ELSE 'seguridad_higiene'
    END AS area_resp,
    CASE
      WHEN g.i <= 12 THEN gannet_demo.sem_n(g.i, 613,  820, 1450, 2)
      WHEN g.i <= 22 THEN gannet_demo.sem_n(g.i, 613, 2400, 3900, 2)
      WHEN g.i <= 28 THEN gannet_demo.sem_n(g.i, 613, 2900, 4600, 2)
      WHEN g.i <= 32 THEN gannet_demo.sem_n(g.i, 613, 1500, 2400, 2)
      WHEN g.i <= 38 THEN gannet_demo.sem_n(g.i, 613,  620, 1050, 2)
      ELSE                gannet_demo.sem_n(g.i, 613, 3200, 5400, 2)
    END AS costo_km,
    CASE
      WHEN g.i <= 12 THEN gannet_demo.sem_n(g.i, 614,  38000000,  62000000, 2)
      WHEN g.i <= 22 THEN gannet_demo.sem_n(g.i, 614, 140000000, 235000000, 2)
      WHEN g.i <= 28 THEN gannet_demo.sem_n(g.i, 614, 210000000, 320000000, 2)
      WHEN g.i <= 32 THEN gannet_demo.sem_n(g.i, 614,  85000000, 130000000, 2)
      WHEN g.i <= 38 THEN gannet_demo.sem_n(g.i, 614,  22000000,  36000000, 2)
      ELSE                gannet_demo.sem_n(g.i, 614, 260000000, 480000000, 2)
    END AS valor
  FROM generate_series(1, 45) AS g(i)
) v
LEFT JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.area = v.area_resp AND e.estado = 'activo'
  ORDER BY gannet_demo.sem_h(e.id, 6150 + v.i), e.id
  LIMIT 1
) resp ON true;

-- =============================================================================
-- 9. equipos — 280 activos
-- El equipo con id I atiende al servicio de indice ((I-1) mod 10) + 1. Por lo
-- tanto los 28 equipos del servicio S son exactamente  S + 10*k, k de 0 a 27.
-- Esa regla es la que garantiza que una OT de soldadura reciba una soldadora y
-- no una hidrolavadora.
-- =============================================================================

DROP TABLE IF EXISTS tmp_eq_cat;
CREATE TEMP TABLE tmp_eq_cat (srv_idx int, k int, categoria text);
INSERT INTO tmp_eq_cat VALUES
  ( 1,0,'herramienta_electrica'),( 1,1,'compresor'),( 1,2,'bomba'),( 1,3,'herramienta_manual'),
  ( 2,0,'equipo_pesado'),        ( 2,1,'andamio'),  ( 2,2,'herramienta_electrica'),( 2,3,'compresor'),
  ( 3,0,'herramienta_electrica'),( 3,1,'instrumento_medicion'),( 3,2,'generador'),( 3,3,'herramienta_manual'),
  ( 4,0,'instrumento_medicion'), ( 4,1,'instrumento_medicion'),( 4,2,'herramienta_manual'),( 4,3,'instrumento_medicion'),
  ( 5,0,'soldadora'),            ( 5,1,'soldadora'),( 5,2,'generador'),( 5,3,'herramienta_electrica'),
  ( 6,0,'epp'),                  ( 6,1,'herramienta_manual'),( 6,2,'compresor'),( 6,3,'epp'),
  ( 7,0,'equipo_pesado'),        ( 7,1,'generador'),( 7,2,'compresor'),( 7,3,'bomba'),
  ( 8,0,'equipo_pesado'),        ( 8,1,'equipo_pesado'),( 8,2,'bomba'),( 8,3,'herramienta_manual'),
  ( 9,0,'bomba'),                ( 9,1,'generador'),( 9,2,'epp'),( 9,3,'herramienta_manual'),
  (10,0,'bomba'),                (10,1,'compresor'),(10,2,'epp'),(10,3,'herramienta_electrica');
CREATE UNIQUE INDEX ON tmp_eq_cat (srv_idx, k);

DROP TABLE IF EXISTS tmp_eq_nom;
CREATE TEMP TABLE tmp_eq_nom (categoria text, k int, nombre text, marca text, valor_lo numeric, valor_hi numeric);
INSERT INTO tmp_eq_nom VALUES
  ('herramienta_electrica',0,'Amoladora angular 9 pulgadas','Bosch',       320000,   680000),
  ('herramienta_electrica',1,'Taladro percutor industrial','Makita',       410000,   890000),
  ('herramienta_electrica',2,'Sierra sensitiva de corte','DeWalt',         520000,  1150000),
  ('herramienta_electrica',3,'Atornillador de impacto a batería','Milwaukee',380000,  790000),
  ('equipo_pesado',        0,'Retroexcavadora 4x4','Caterpillar',        95000000,175000000),
  ('equipo_pesado',        1,'Minicargadora sobre orugas','Bobcat',      62000000,110000000),
  ('equipo_pesado',        2,'Motoniveladora de 140 HP','John Deere',   130000000,240000000),
  ('equipo_pesado',        3,'Rodillo compactador vibratorio','Hamm',    58000000,105000000),
  ('instrumento_medicion', 0,'Calibrador de lazo HART','Fluke',           4200000, 8600000),
  ('instrumento_medicion', 1,'Multímetro de proceso','Fluke',             1800000, 3900000),
  ('instrumento_medicion', 2,'Manómetro patrón digital','WIKA',           1200000, 2700000),
  ('instrumento_medicion', 3,'Cámara termográfica industrial','Flir',     6800000,14500000),
  ('soldadora',            0,'Soldadora inverter 400 A','Lincoln Electric',3100000, 6200000),
  ('soldadora',            1,'Semiautomática MIG/MAG 350 A','ESAB',       4400000, 8900000),
  ('soldadora',            2,'Equipo TIG 300 A refrigerado','Fronius',    5600000,11200000),
  ('soldadora',            3,'Motosoldadora diesel 500 A','Miller',      12000000,22000000),
  ('generador',            0,'Grupo electrógeno 60 kVA','Cummins',        9800000,18500000),
  ('generador',            1,'Grupo electrógeno 150 kVA','Perkins',      24000000,42000000),
  ('generador',            2,'Grupo electrógeno portátil 8 kVA','Honda',   1900000, 3600000),
  ('generador',            3,'Torre de iluminación con generador','Atlas Copco',7200000,13400000),
  ('compresor',            0,'Compresor de tornillo 100 HP','Atlas Copco',18000000,34000000),
  ('compresor',            1,'Compresor portátil 185 CFM','Sullair',      11500000,21000000),
  ('compresor',            2,'Compresor a pistón 5 HP','Schulz',           1400000, 2900000),
  ('compresor',            3,'Secador de aire refrigerativo','Kaeser',     3800000, 7100000),
  ('bomba',                0,'Bomba centrífuga autocebante 4 pulgadas','Grundfos',3200000,6400000),
  ('bomba',                1,'Hidrolavadora industrial 500 bar','Kärcher', 5900000,11800000),
  ('bomba',                2,'Bomba sumergible para achique','Tsurumi',    2100000, 4300000),
  ('bomba',                3,'Bomba de vacío para camión atmosférico','Jurop',8400000,15600000),
  ('andamio',              0,'Módulo de andamio tubular certificado','Layher',480000, 920000),
  ('andamio',              1,'Plataforma de trabajo con baranda','Layher',  390000,  760000),
  ('andamio',              2,'Escalera de acceso para andamio','Layher',    210000,  440000),
  ('andamio',              3,'Base regulable con ruedas','Layher',          160000,  330000),
  ('epp',                  0,'Arnés de altura de cuerpo completo','3M',     280000,  560000),
  ('epp',                  1,'Equipo autónomo de respiración','MSA',       4600000, 8900000),
  ('epp',                  2,'Detector multigás portátil','Dräger',        2300000, 4700000),
  ('epp',                  3,'Kit de rescate en espacio confinado','Petzl', 3100000, 6100000),
  ('herramienta_manual',   0,'Juego de llaves combinadas milimétricas','Bahco',180000, 390000),
  ('herramienta_manual',   1,'Torquímetro de 300 Nm calibrado','Stahlwille',   620000,1280000),
  ('herramienta_manual',   2,'Extractor hidráulico de rodamientos','SKF',     840000,1690000),
  ('herramienta_manual',   3,'Juego de herramientas antichispa','Ampco',    1100000,2200000);
CREATE UNIQUE INDEX ON tmp_eq_nom (categoria, k);

INSERT INTO gannet_demo.equipos (
  id, codigo_interno, nombre, categoria, servicio_id, marca, modelo, numero_serie,
  estado, es_alquilable, tarifa_dia_ars, valor_ars, deposito_id, responsable_id, proxima_calibracion
)
OVERRIDING SYSTEM VALUE
SELECT
  q.i,
  'EQ-' || lpad(q.i::text, 4, '0'),
  n.nombre,
  q.categoria,
  s.id,
  n.marca,
  upper(substr(md5(n.nombre), 1, 3)) || '-' || (100 + gannet_demo.sem_h(q.i, 701) % 900)::text,
  'SN' || lpad((gannet_demo.sem_h(q.i, 702) % 100000000)::text, 8, '0'),
  q.estado,
  q.alquilable,
  CASE WHEN q.alquilable
       THEN round(gannet_demo.sem_n(q.i, 703, 0.0030, 0.0075, 6)
                  * gannet_demo.sem_n(q.i, 704, n.valor_lo, n.valor_hi, 2), 2)
       ELSE NULL END,
  gannet_demo.sem_n(q.i, 704, n.valor_lo, n.valor_hi, 2),
  q.deposito,
  resp.id,
  -- El instrumental de medicion tiene calibracion obligatoria; una parte queda
  -- vencida a proposito para alimentar el panel de vencimientos.
  CASE WHEN q.categoria = 'instrumento_medicion'
       THEN (CURRENT_DATE + gannet_demo.sem_i(q.i, 705, -55, 330))::date
       ELSE NULL END
FROM (
  SELECT
    g.i,
    ((g.i - 1) % 10) + 1 AS srv_idx,
    c.categoria,
    1 + gannet_demo.sem_h(g.i, 706) % 8 AS deposito,
    CASE
      WHEN gannet_demo.sem_h(g.i, 707) % 100 < 25 THEN 'asignado'
      WHEN gannet_demo.sem_h(g.i, 707) % 100 < 33 THEN 'en_mantenimiento'
      WHEN gannet_demo.sem_h(g.i, 707) % 100 < 37 THEN 'en_calibracion'
      WHEN gannet_demo.sem_h(g.i, 707) % 100 < 40 THEN 'fuera_servicio'
      WHEN gannet_demo.sem_h(g.i, 707) % 100 < 41 THEN 'baja'
      ELSE 'disponible'
    END AS estado,
    (c.categoria IN ('equipo_pesado','generador','compresor','bomba')
     OR ((g.i - 1) % 10) + 1 = 7) AS alquilable
  FROM generate_series(1, 280) AS g(i)
  JOIN tmp_eq_cat c
    ON c.srv_idx = ((g.i - 1) % 10) + 1
   AND c.k = (gannet_demo.sem_h(g.i, 708) % 4)::int
) q
JOIN tmp_srv s ON s.idx = q.srv_idx
JOIN tmp_eq_nom n
  ON n.categoria = q.categoria
 AND n.k = (gannet_demo.sem_h(q.i, 709) % 4)::int
LEFT JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.especialidad_servicio_id = s.id AND e.estado = 'activo'
  ORDER BY gannet_demo.sem_h(e.id, 7100 + q.i), e.id
  LIMIT 1
) resp ON true;

-- =============================================================================
-- 10. articulos — 150 items de catalogo
-- =============================================================================

DROP TABLE IF EXISTS tmp_art;
CREATE TEMP TABLE tmp_art (cat_idx int, categoria text, unidad text, k int, base text, costo_lo numeric, costo_hi numeric);
INSERT INTO tmp_art VALUES
  (1,'repuesto','unidad',0,'Rodamiento rígido de bolas',            42000,  185000),
  (1,'repuesto','unidad',1,'Reten de eje',                          18000,   72000),
  (1,'repuesto','unidad',2,'Correa trapezoidal',                    26000,   95000),
  (1,'repuesto','unidad',3,'Filtro de aceite motor',                31000,  120000),
  (1,'repuesto','unidad',4,'Kit de sellos hidráulicos',            110000,  420000),
  (2,'consumible','caja',0,'Electrodo revestido E6013 3,25 mm',     78000,  240000),
  (2,'consumible','rollo',1,'Alambre tubular MIG 1,2 mm',          145000,  480000),
  (2,'consumible','caja',2,'Disco de corte 9 pulgadas',             52000,  165000),
  (2,'consumible','caja',3,'Disco de desbaste 7 pulgadas',          46000,  148000),
  (2,'consumible','unidad',4,'Boquilla de contacto para antorcha',   9000,   34000),
  (3,'epp','par',0,'Guantes de descarne',                           14000,   46000),
  (3,'epp','unidad',1,'Casco de seguridad con barbijo',             38000,  110000),
  (3,'epp','par',2,'Botín de seguridad con puntera',                95000,  260000),
  (3,'epp','unidad',3,'Antiparra panorámica',                       17000,   52000),
  (3,'epp','unidad',4,'Protector auditivo tipo copa',               21000,   68000),
  (4,'lubricante','litro',0,'Aceite hidráulico ISO VG 68',          16000,   44000),
  (4,'lubricante','litro',1,'Aceite motor 15W40 mineral',           19000,   52000),
  (4,'lubricante','kg',2,'Grasa de litio EP2',                      23000,   61000),
  (4,'lubricante','litro',3,'Refrigerante concentrado',             15000,   41000),
  (4,'lubricante','litro',4,'Aceite de engranajes ISO VG 220',      21000,   58000),
  (5,'combustible','litro',0,'Gasoil grado 2',                        1400,   2600),
  (5,'combustible','litro',1,'Gasoil grado 3 premium',                1700,   3100),
  (5,'combustible','kg',2,'Gas envasado para campamento',             2200,   4400),
  (5,'combustible','litro',3,'Nafta súper',                           1600,   2900),
  (5,'combustible','litro',4,'Aditivo AdBlue',                        2100,   3800),
  (6,'ferreteria','caja',0,'Bulón hexagonal grado 8.8',              34000,  112000),
  (6,'ferreteria','caja',1,'Tuerca autofrenante',                    18000,   59000),
  (6,'ferreteria','rollo',2,'Cinta de teflón para roscas',            6000,   19000),
  (6,'ferreteria','unidad',3,'Abrazadera reforzada de acero',        11000,   38000),
  (6,'ferreteria','metro',4,'Caño estructural cuadrado',             28000,   94000),
  (7,'electrico','metro',0,'Cable subterráneo tetrapolar',           47000,  158000),
  (7,'electrico','unidad',1,'Contactor tripolar 40 A',              210000,  680000),
  (7,'electrico','unidad',2,'Guardamotor regulable',                185000,  560000),
  (7,'electrico','unidad',3,'Prensacable metálico',                  12000,   39000),
  (7,'electrico','metro',4,'Bandeja portacable perforada',           64000,  205000),
  (8,'quimico','litro',0,'Desengrasante industrial biodegradable',   19000,   58000),
  (8,'quimico','litro',1,'Solvente dieléctrico',                     27000,   82000),
  (8,'quimico','kg',2,'Antioxidante en pasta',                       33000,   98000),
  (8,'quimico','litro',3,'Esmalte sintético para estructuras',       24000,   74000),
  (8,'quimico','litro',4,'Convertidor de óxido',                     22000,   66000),
  (9,'papeleria','caja',0,'Resma de papel A4',                       14000,   32000),
  (9,'papeleria','unidad',1,'Cartucho de tóner monocromo',          180000,  420000),
  (9,'papeleria','caja',2,'Formulario de permiso de trabajo',        21000,   54000),
  (9,'papeleria','unidad',3,'Carpeta de obra con anillos',            9000,   26000),
  (9,'papeleria','caja',4,'Etiqueta autoadhesiva para inventario',   16000,   44000);
CREATE UNIQUE INDEX ON tmp_art (cat_idx, k);

INSERT INTO gannet_demo.articulos (
  id, codigo, descripcion, categoria, unidad_medida, stock_minimo, costo_unitario_ars, activo
)
OVERRIDING SYSTEM VALUE
SELECT
  a.i,
  'ART-' || lpad(a.i::text, 4, '0'),
  t.base || ' — ' ||
    (ARRAY['estándar','reforzado','uso minero','serie pesada','alta temperatura',
           'antichispa','trabajo pesado','grado industrial'])
      [1 + gannet_demo.sem_h(a.i, 801) % 8],
  t.categoria,
  t.unidad,
  gannet_demo.sem_n(a.i, 802, 8, 240, 2),
  gannet_demo.sem_n(a.i, 803, t.costo_lo, t.costo_hi, 2),
  (gannet_demo.sem_h(a.i, 804) % 100) >= 5
FROM generate_series(1, 150) AS a(i)
JOIN tmp_art t
  ON t.cat_idx = ((a.i - 1) % 9) + 1
 AND t.k = (gannet_demo.sem_h(a.i, 805) % 5)::int;

-- =============================================================================
-- 11. stock — existencias por articulo y deposito
-- Cada articulo esta presente en dos a cuatro depositos. Los depositos se
-- eligen con paso 3 sobre un anillo de 8, lo que garantiza que no se repitan y
-- por lo tanto satisface la unicidad (articulo_id, deposito_id).
-- Los articulos cuyo id es multiplo de 13 quedan deliberadamente por debajo del
-- stock minimo: son el "stock critico" que el presentador puede señalar.
-- =============================================================================

INSERT INTO gannet_demo.stock (id, articulo_id, deposito_id, cantidad, actualizado_en)
OVERRIDING SYSTEM VALUE
SELECT
  row_number() OVER (ORDER BY s.articulo_id, s.deposito_id),
  s.articulo_id,
  s.deposito_id,
  s.cantidad,
  (CURRENT_DATE - gannet_demo.sem_i(s.articulo_id * 10 + s.deposito_id, 902, 0, 45))::timestamptz
    + (gannet_demo.sem_h(s.articulo_id, 903) % 36000) * INTERVAL '1 second'
FROM (
  SELECT
    a.id AS articulo_id,
    1 + ((gannet_demo.sem_h(a.id, 901) + j * 3) % 8)::int AS deposito_id,
    CASE
      WHEN a.id % 13 = 0 THEN round(a.stock_minimo * gannet_demo.sem_n(a.id * 10 + j, 904, 0.02, 0.12, 4), 2)
      ELSE round(a.stock_minimo * gannet_demo.sem_n(a.id * 10 + j, 904, 1.30, 6.50, 4), 2)
    END AS cantidad
  FROM gannet_demo.articulos a
  CROSS JOIN LATERAL generate_series(1, 2 + (gannet_demo.sem_h(a.id, 905) % 3)::int) AS j
) s;

-- =============================================================================
-- 12. proveedores — 40 proveedores DE Andes
-- =============================================================================

INSERT INTO gannet_demo.proveedores (
  id, razon_social, cuit, rubro, contacto, email, telefono, condicion_pago_dias, calificacion, activo
)
OVERRIDING SYSTEM VALUE
SELECT
  p.id, p.razon_social,
  '30-' || (60000000 + gannet_demo.sem_h(p.id, 1001) % 9000000)::text
        || '-' || (gannet_demo.sem_h(p.id, 1002) % 10)::text,
  p.rubro,
  (ARRAY['Ricardo Ávila','Mariana Sosa','Julio Benítez','Carla Domínguez','Néstor Paz',
         'Lorena Vidal','Ariel Montenegro','Sandra Rey','Emilio Barros','Vanina Costa'])
    [1 + gannet_demo.sem_h(p.id, 1003) % 10],
  'ventas@' || p.slug || '.com.ar',
  '+54 11 ' || lpad((gannet_demo.sem_h(p.id, 1004) % 100000000)::text, 8, '0'),
  (ARRAY[15, 30, 30, 45, 60])[1 + gannet_demo.sem_h(p.id, 1005) % 5],
  (ARRAY[3,4,4,4,5,5,5,2])[1 + gannet_demo.sem_h(p.id, 1006) % 8],
  (gannet_demo.sem_h(p.id, 1007) % 100) >= 10
FROM (
  VALUES
    ( 1,'Aceros del Norte S.R.L.',           'acerosdelnorte',     'materiales'),
    ( 2,'Ferretería Industrial Salta S.A.',  'ferrindsalta',       'materiales'),
    ( 3,'Distribuidora Cuyo Metales S.R.L.', 'cuyometales',        'materiales'),
    ( 4,'Cementos y Áridos Puna S.A.',       'aridospuna',         'materiales'),
    ( 5,'Perfilería Andina S.R.L.',          'perfileriaandina',   'materiales'),
    ( 6,'Repuestos Diesel del Valle S.R.L.', 'repuestosdelvalle',  'repuestos'),
    ( 7,'Rodamientos Argentinos S.A.',       'rodamientosarg',     'repuestos'),
    ( 8,'Hidráulica Integral S.R.L.',        'hidraulicaintegral', 'repuestos'),
    ( 9,'Autopartes Mineras del Sur S.A.',   'autopartessur',      'repuestos'),
    (10,'Filtros y Correas Cuyo S.R.L.',     'filtroscuyo',        'repuestos'),
    (11,'Combustibles del Altiplano S.A.',   'combaltiplano',      'combustible'),
    (12,'Petrolera Andina Distribución S.A.','petroleraandina',    'combustible'),
    (13,'Lubricantes Técnicos NOA S.R.L.',   'lubricantesnoa',     'combustible'),
    (14,'Gas Envasado Puna S.R.L.',          'gasenvasadopuna',    'combustible'),
    (15,'Montajes Eléctricos Beltrán S.R.L.','montajesbeltran',    'subcontrato'),
    (16,'Obras Viales Catamarca S.A.',       'obrasvialescat',     'subcontrato'),
    (17,'Perforaciones del Oeste S.R.L.',    'perforacionesoeste', 'subcontrato'),
    (18,'Estructuras Metálicas Jáchal S.A.', 'estructurasjachal',  'subcontrato'),
    (19,'Instrumentación Aplicada S.R.L.',   'instrumentacionap',  'subcontrato'),
    (20,'Aislaciones Térmicas Andes S.R.L.', 'aislacionesandes',   'subcontrato'),
    (21,'Calibraciones Metrológicas S.A.',   'calibracionesmet',   'servicios'),
    (22,'Taller Diesel Norte Grande S.R.L.', 'tallernortegrande',  'servicios'),
    (23,'Ensayos No Destructivos NOA S.A.',  'endnoa',             'servicios'),
    (24,'Higiene y Seguridad Consultora S.R.L.','hysconsultora',   'servicios'),
    (25,'Catering Minero del Norte S.A.',    'cateringminero',     'servicios'),
    (26,'Lavadero Industrial Puna S.R.L.',   'lavaderopuna',       'servicios'),
    (27,'Transporte Pesado Andino S.A.',     'transporteandino',   'logistica'),
    (28,'Logística Integral Cuyo S.R.L.',    'logisticacuyo',      'logistica'),
    (29,'Fletes y Cargas del NOA S.A.',      'fletesnoa',          'logistica'),
    (30,'Grúas y Izajes Patagonia S.R.L.',   'gruaspatagonia',     'logistica'),
    (31,'Seguridad Laboral Integral S.A.',   'seglaboralintegral', 'epp'),
    (32,'Indumentaria Técnica Andina S.R.L.','indumentariaandina', 'epp'),
    (33,'Protección Respiratoria S.A.',      'proteccionresp',     'epp'),
    (34,'Calzado de Seguridad Cuyo S.R.L.',  'calzadocuyo',        'epp'),
    (35,'Alquiler de Maquinaria Vial S.A.',  'alquilervial',       'alquileres'),
    (36,'Módulos Habitacionales Puna S.R.L.','moduloshabpuna',     'alquileres'),
    (37,'Generadores en Alquiler NOA S.A.',  'generadoresnoa',     'alquileres'),
    (38,'Andamios y Encofrados Cuyo S.R.L.', 'andamioscuyo',       'alquileres'),
    (39,'Baños Químicos del Norte S.R.L.',   'banosquimicosnorte', 'alquileres'),
    (40,'Contenedores Modulares S.A.',       'contenedoresmod',    'alquileres')
) AS p(id, razon_social, slug, rubro);

-- =============================================================================
-- 13. proyectos — 80 contratos
-- Los importes NO se fijan aqui. Se derivan al final de la suma de las ordenes
-- de trabajo del proyecto, que es lo que garantiza que el drill-down cierre:
-- monto_ejecutado_ars es exactamente la suma de las OT completadas.
-- =============================================================================

INSERT INTO gannet_demo.proyectos (
  id, codigo, nombre, cliente_id, faena_id, servicio_id, responsable_id, tipo_contrato,
  estado, fecha_inicio_plan, fecha_fin_plan, fecha_inicio_real, fecha_fin_real,
  monto_contrato_ars, monto_ejecutado_ars, avance_pct, margen_objetivo_pct
)
OVERRIDING SYSTEM VALUE
SELECT
  d.i,
  'PRY-' || to_char(d.ini_plan, 'YYYY') || '-' || lpad(d.i::text, 3, '0'),
  -- PROVISIONAL, igual que el titulo de las ordenes de trabajo: el nombre
  -- definitivo lo escribe gannet_demo.aplicar_catalogo_textos() en el bloque
  -- 25.b. Con un solo nombre por servicio, diez de los ochenta proyectos
  -- quedaban con el nombre repetido.
  '(pendiente de catalogo) ' || s.nombre || ' — ' || fa.nombre,
  d.cliente_id,
  d.faena_id,
  s.id,
  resp.id,
  (ARRAY['por_servicio','por_obra','por_obra','por_servicio','por_obra',
         'oc_abierta','oc_abierta','por_obra','por_servicio','por_servicio'])[d.srv_idx],
  d.estado,
  d.ini_plan,
  d.fin_plan,
  d.ini_real,
  d.fin_real,
  NULL, NULL, NULL,
  gannet_demo.sem_n(d.i, 1109, 8, 28, 2)
FROM (
  SELECT
    d0.*,
    -- La fecha de fin planificada siempre respeta el CHECK del esquema porque
    -- la duracion minima de un proyecto (45 dias) supera cualquier ajuste.
    (d0.ini_plan + d0.dur
       + CASE WHEN d0.estado = 'finalizado'
              THEN gannet_demo.sem_i(d0.i, 1108, -10, 40) ELSE 0 END)::date AS fin_plan
  FROM (
  SELECT
    c.*,
    CASE c.estado
      WHEN 'planificado' THEN (CURRENT_DATE + gannet_demo.sem_i(c.i, 1106, 6, 130))::date
      WHEN 'finalizado'  THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 10, 430) - c.dur - gannet_demo.sem_i(c.i, 1107, 0, 20))::date
      WHEN 'en_curso'    THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 12, 380) - gannet_demo.sem_i(c.i, 1107, 0, 15))::date
      WHEN 'suspendido'  THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 60, 400) - 8)::date
      ELSE                    (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 90, 450) - 6)::date
    END AS ini_plan,
    CASE c.estado
      WHEN 'planificado' THEN NULL::date
      WHEN 'finalizado'  THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 10, 430) - c.dur)::date
      WHEN 'en_curso'    THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 12, 380))::date
      WHEN 'suspendido'  THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 60, 400))::date
      ELSE                    (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 90, 450))::date
    END AS ini_real,
    CASE c.estado
      WHEN 'finalizado' THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 10, 430))::date
      WHEN 'cancelado'  THEN (CURRENT_DATE - gannet_demo.sem_i(c.i, 1106, 90, 450) + (c.dur / 3))::date
      ELSE NULL::date
    END AS fin_real
  FROM (
    SELECT
      b.i, b.cliente_id, b.faena_id, b.srv_idx, b.estado, b.dur
    FROM (
      SELECT
        a.i,
        pc.cliente_id,
        tf.faena_id,
        ps.idx AS srv_idx,
        CASE
          WHEN gannet_demo.sem_h(a.i, 1104) % 100 < 40 THEN 'finalizado'
          WHEN gannet_demo.sem_h(a.i, 1104) % 100 < 75 THEN 'en_curso'
          WHEN gannet_demo.sem_h(a.i, 1104) % 100 < 87 THEN 'planificado'
          WHEN gannet_demo.sem_h(a.i, 1104) % 100 < 93 THEN 'suspendido'
          ELSE 'cancelado'
        END AS estado,
        gannet_demo.sem_i(a.i, 1105,
          (ARRAY[120, 90, 60, 45, 60,120, 90, 60,180, 90])[ps.idx],
          (ARRAY[540,420,260,200,300,540,400,280,545,400])[ps.idx]) AS dur
      FROM generate_series(1, 80) AS a(i)
      JOIN tmp_peso_cliente pc
        ON gannet_demo.sem_r(a.i, 1103) >= pc.lo AND gannet_demo.sem_r(a.i, 1103) < pc.hi
      JOIN tmp_peso_servicio ps
        ON gannet_demo.sem_r(a.i, 1102) >= ps.lo AND gannet_demo.sem_r(a.i, 1102) < ps.hi
      JOIN tmp_faena tf
        ON tf.cliente_id = pc.cliente_id
       AND tf.n = 1 + gannet_demo.sem_h(a.i, 1101) % tf.total
    ) b
  ) c
  ) d0
) d
JOIN tmp_srv s ON s.idx = d.srv_idx
JOIN gannet_demo.faenas fa ON fa.id = d.faena_id
LEFT JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.especialidad_servicio_id = s.id AND e.estado <> 'baja' AND e.id <= 30
  ORDER BY gannet_demo.sem_h(e.id, 11100 + d.i), e.id
  LIMIT 1
) resp ON true;

-- Reparto de Pareto de las ordenes de trabajo entre proyectos: unos pocos
-- contratos grandes concentran el grueso de la operacion.
DROP TABLE IF EXISTS tmp_peso_proyecto;
CREATE TEMP TABLE tmp_peso_proyecto AS
WITH w AS (
  SELECT id AS proyecto_id, 1 + 3000 / (id + 8) AS peso FROM gannet_demo.proyectos
)
SELECT
  proyecto_id,
  (SUM(peso) OVER (ORDER BY proyecto_id ROWS UNBOUNDED PRECEDING) - peso)::numeric
    / SUM(peso) OVER ()::numeric AS lo,
  SUM(peso) OVER (ORDER BY proyecto_id ROWS UNBOUNDED PRECEDING)::numeric
    / SUM(peso) OVER ()::numeric AS hi
FROM w;

CREATE INDEX ON tmp_peso_proyecto (lo, hi);

-- =============================================================================
-- 14. ordenes_trabajo — 1.350 ordenes
-- Reglas de coherencia de recursos, que son las que sostienen el drill-down:
--   * el equipo asignado pertenece SIEMPRE al servicio de la orden, y ademas se
--     restringe la categoria cuando el servicio lo exige (soldadora para
--     soldadura, equipo pesado para movimiento de suelos, instrumental para
--     instrumentacion);
--   * el vehiculo asignado es del tipo apto para el servicio: camiones y
--     tractores para transporte, camionetas para trabajos tecnicos;
--   * el responsable es un jefe o tecnico senior de la especialidad del
--     servicio, nunca alguien de otra area;
--   * las ordenes vigentes solo toman recursos operativos, no dados de baja.
-- =============================================================================

INSERT INTO gannet_demo.ordenes_trabajo (
  id, numero, cliente_id, proyecto_id, faena_id, servicio_id, responsable_id,
  vehiculo_id, equipo_id, titulo, descripcion, tipo, prioridad, estado,
  fecha_programada, fecha_inicio, fecha_fin, horas_estimadas, horas_reales,
  costo_mano_obra_ars, costo_materiales_ars, monto_facturable_ars,
  requiere_permiso, incidentes_seguridad
)
OVERRIDING SYSTEM VALUE
SELECT
  f.i,
  'OT-' || lpad(f.i::text, 5, '0'),
  f.cliente_id,
  f.proyecto_id,
  f.faena_id,
  f.servicio_id,
  resp.id,
  veh.id,
  equ.id,
  -- PROVISIONAL. El titulo y la descripcion definitivos los escribe
  -- gannet_demo.aplicar_catalogo_textos() en el bloque 25.b, tomandolos de
  -- gannet_demo.catalogo_textos. No agregar aca una lista de titulos: hubo una
  -- sola por servicio y produjo una grilla que se leia copiada y pegada.
  -- El bloque 25.b verifica que ningun texto provisional sobreviva.
  '(pendiente de catalogo) ' || sv.nombre || ' — ' || fa.nombre,
  '(pendiente de catalogo)',
  f.tipo,
  f.prioridad,
  f.estado,
  f.fecha_prog,
  CASE WHEN f.estado IN ('completada','pausada','en_ejecucion')
       THEN f.fecha_prog::timestamptz + (gannet_demo.sem_i(f.i, 1220, 6, 9) || ' hours')::interval
       ELSE NULL END,
  CASE WHEN f.estado = 'completada'
       THEN LEAST(
              f.fecha_prog::timestamptz
                + (gannet_demo.sem_i(f.i, 1220, 6, 9) || ' hours')::interval
                + (ceil(f.horas_reales / 9.0)::int || ' days')::interval
                + (gannet_demo.sem_i(f.i, 1221, 0, 5) || ' hours')::interval,
              CURRENT_DATE::timestamptz + INTERVAL '19 hours')
       ELSE NULL END,
  f.horas_est,
  f.horas_reales,
  CASE WHEN f.horas_reales IS NOT NULL
       THEN round(f.horas_reales * f.cuadrilla * f.tarifa, 2) ELSE NULL END,
  CASE WHEN f.horas_reales IS NOT NULL
       THEN round(f.horas_reales * f.cuadrilla * f.tarifa * f.mat_ratio, 2) ELSE NULL END,
  round(COALESCE(f.horas_reales, f.horas_est) * f.cuadrilla * f.tarifa
        * (1 + f.mat_ratio) * f.margen, 2),
  f.srv_idx IN (2, 3, 5, 8) OR gannet_demo.sem_h(f.i, 1222) % 100 < 22,
  CASE WHEN gannet_demo.sem_h(f.i, 1223) % 1000 < 6  THEN 2
       WHEN gannet_demo.sem_h(f.i, 1223) % 1000 < 34 THEN 1
       ELSE 0 END
FROM (
  SELECT
    e.*,
    CASE WHEN e.estado IN ('completada','pausada','en_ejecucion')
         THEN round(e.horas_est * gannet_demo.sem_n(e.i, 1214, 0.82, 1.35, 4), 2)
         ELSE NULL END AS horas_reales
  FROM (
    SELECT
      d.*,
      CASE
        WHEN d.p_estado = 'cancelado' AND gannet_demo.sem_h(d.i, 1210) % 100 < 55 THEN 'cancelada'
        WHEN d.fecha_prog > CURRENT_DATE THEN
          CASE WHEN gannet_demo.sem_h(d.i, 1211) % 100 < 84 THEN 'programada' ELSE 'borrador' END
        WHEN d.fecha_prog >= CURRENT_DATE - 3 THEN 'en_ejecucion'
        WHEN d.p_estado = 'suspendido' AND d.fecha_prog > CURRENT_DATE - 60 THEN 'pausada'
        ELSE
          CASE WHEN gannet_demo.sem_h(d.i, 1211) % 100 < 88 THEN 'completada'
               WHEN gannet_demo.sem_h(d.i, 1211) % 100 < 94 THEN 'pausada'
               ELSE 'cancelada' END
      END AS estado,
      gannet_demo.sem_n(d.i, 1212,
        (ARRAY[ 16,120, 30, 24, 40,  8, 24, 90,110, 16])[d.srv_idx],
        (ARRAY[ 90,460,150,110,190, 52,130,360,380, 85])[d.srv_idx], 2) AS horas_est,
      gannet_demo.sem_i(d.i, 1213,
        (ARRAY[1,2,2,1,2,1,1,2,3,2])[d.srv_idx],
        (ARRAY[3,4,3,2,4,2,2,4,5,3])[d.srv_idx]) AS cuadrilla,
      gannet_demo.sem_n(d.i, 1215, 16000, 24000, 2) AS tarifa,
      round((ARRAY[0.45,1.60,0.90,1.10,0.85,2.20,2.80,1.90,1.15,0.45])[d.srv_idx]
            * gannet_demo.sem_n(d.i, 1216, 0.62, 1.40, 4), 4) AS mat_ratio,
      CASE WHEN gannet_demo.sem_h(d.i, 1217) % 100 < 6
           THEN gannet_demo.sem_n(d.i, 1218, 0.94, 1.06, 4)
           ELSE gannet_demo.sem_n(d.i, 1218, 1.12, 1.38, 4) END AS margen,
      CASE
        WHEN gannet_demo.sem_h(d.i, 1219) % 100 < 34 THEN 'preventivo'
        WHEN gannet_demo.sem_h(d.i, 1219) % 100 < 58 THEN 'correctivo'
        WHEN gannet_demo.sem_h(d.i, 1219) % 100 < 76 THEN 'programado'
        WHEN gannet_demo.sem_h(d.i, 1219) % 100 < 86 THEN 'inspeccion'
        WHEN gannet_demo.sem_h(d.i, 1219) % 100 < 96 THEN 'instalacion'
        ELSE 'emergencia'
      END AS tipo,
      CASE
        WHEN gannet_demo.sem_h(d.i, 1224) % 100 < 20 THEN 'baja'
        WHEN gannet_demo.sem_h(d.i, 1224) % 100 < 70 THEN 'media'
        WHEN gannet_demo.sem_h(d.i, 1224) % 100 < 94 THEN 'alta'
        ELSE 'critica'
      END AS prioridad
    FROM (
      SELECT
        c.i, c.proyecto_id, c.p_estado,
        COALESCE(c.p_cliente, c.s_cliente)  AS cliente_id,
        COALESCE(c.p_faena, c.s_faena)      AS faena_id,
        COALESCE(c.p_servicio, c.s_servicio) AS servicio_id,
        COALESCE(c.p_srv_idx, c.s_srv_idx)  AS srv_idx,
        CASE
          WHEN c.proyecto_id IS NOT NULL THEN
            (c.p_ini + (gannet_demo.sem_h(c.i, 1204) % (GREATEST(c.p_fin - c.p_ini, 1) + 1))::int)::date
          ELSE cal.fecha
        END AS fecha_prog
      FROM (
        SELECT
          a.i, a.proyecto_id,
          p.estado AS p_estado, p.cliente_id AS p_cliente, p.faena_id AS p_faena,
          p.servicio_id AS p_servicio, psrv.idx AS p_srv_idx,
          COALESCE(p.fecha_inicio_real, p.fecha_inicio_plan) AS p_ini,
          COALESCE(p.fecha_fin_real, p.fecha_fin_plan)       AS p_fin,
          pc.cliente_id AS s_cliente, tf.faena_id AS s_faena, ps.idx AS s_srv_idx,
          ssrv.id AS s_servicio
        FROM (
          SELECT
            g.i,
            CASE
              WHEN g.i <= 80   THEN g.i::bigint
              WHEN g.i <= 1080 THEN pp.proyecto_id
              ELSE NULL::bigint
            END AS proyecto_id
          FROM generate_series(1, 1350) AS g(i)
          LEFT JOIN tmp_peso_proyecto pp
            ON g.i BETWEEN 81 AND 1080
           AND gannet_demo.sem_r(g.i, 1201) >= pp.lo
           AND gannet_demo.sem_r(g.i, 1201) <  pp.hi
        ) a
        LEFT JOIN gannet_demo.proyectos p ON p.id = a.proyecto_id
        LEFT JOIN tmp_srv psrv ON psrv.id = p.servicio_id
        LEFT JOIN tmp_peso_cliente pc
          ON a.proyecto_id IS NULL
         AND gannet_demo.sem_r(a.i, 1202) >= pc.lo AND gannet_demo.sem_r(a.i, 1202) < pc.hi
        LEFT JOIN tmp_peso_servicio ps
          ON a.proyecto_id IS NULL
         AND gannet_demo.sem_r(a.i, 1203) >= ps.lo AND gannet_demo.sem_r(a.i, 1203) < ps.hi
        LEFT JOIN tmp_srv ssrv ON ssrv.idx = ps.idx
        LEFT JOIN tmp_faena tf
          ON a.proyecto_id IS NULL AND tf.cliente_id = pc.cliente_id
         AND tf.n = 1 + gannet_demo.sem_h(a.i, 1205) % tf.total
      ) c
      LEFT JOIN tmp_calendario cal
        ON c.proyecto_id IS NULL
       AND gannet_demo.sem_r(c.i, 1206) >= cal.lo AND gannet_demo.sem_r(c.i, 1206) < cal.hi
    ) d
  ) e
) f
JOIN tmp_srv sv ON sv.id = f.servicio_id
JOIN gannet_demo.faenas fa ON fa.id = f.faena_id
LEFT JOIN LATERAL (
  SELECT emp.id FROM gannet_demo.empleados emp
  WHERE emp.especialidad_servicio_id = f.servicio_id
    AND emp.estado <> 'baja'
    AND emp.id <= 70
  ORDER BY gannet_demo.sem_h(emp.id, 12000 + f.i), emp.id
  LIMIT 1
) resp ON true
LEFT JOIN LATERAL (
  SELECT v.id FROM gannet_demo.vehiculos v
  WHERE v.tipo = ANY (
          CASE
            WHEN f.srv_idx = 6 THEN ARRAY['camion','tractor_semi','minibus','cisterna']
            WHEN f.srv_idx IN (2, 8) THEN ARRAY['camion','hormigonera','grua']
            WHEN f.srv_idx = 7 THEN ARRAY['tractor_semi','camion']
            ELSE ARRAY['camioneta','utilitario']
          END)
    AND (f.estado IN ('completada','cancelada') OR v.estado = 'operativo')
  ORDER BY gannet_demo.sem_h(v.id, 13000 + f.i), v.id
  LIMIT 1
) veh ON (f.srv_idx = 6 OR gannet_demo.sem_h(f.i, 1207) % 100 < 62)
LEFT JOIN LATERAL (
  SELECT eq.id FROM gannet_demo.equipos eq
  WHERE eq.servicio_id = f.servicio_id
    AND (CASE
           WHEN f.srv_idx IN (2, 7, 8) THEN eq.categoria = 'equipo_pesado'
           WHEN f.srv_idx = 5 THEN eq.categoria = 'soldadora'
           WHEN f.srv_idx = 4 THEN eq.categoria = 'instrumento_medicion'
           ELSE true
         END)
    AND (f.estado IN ('completada','cancelada') OR eq.estado IN ('disponible','asignado'))
  ORDER BY gannet_demo.sem_h(eq.id, 14000 + f.i), eq.id
  LIMIT 1
) equ ON (f.srv_idx <> 6);

-- -----------------------------------------------------------------------------
-- Cierre economico de proyectos: monto ejecutado = suma de las OT completadas;
-- monto contratado = alcance original completo (todas sus OT, incluidas las
-- canceladas) mas una contingencia del 4 al 16 por ciento; avance fisico
-- acotado por el estado del proyecto.
-- -----------------------------------------------------------------------------

UPDATE gannet_demo.proyectos p
SET monto_contrato_ars  = r.contrato,
    monto_ejecutado_ars = r.ejecutado,
    avance_pct = CASE p.estado
      WHEN 'finalizado'  THEN 100
      WHEN 'planificado' THEN 0
      WHEN 'en_curso'    THEN LEAST(95, GREATEST( 5, round(100 * r.ejecutado / r.contrato)::int))
      WHEN 'suspendido'  THEN LEAST(70, GREATEST(10, round(100 * r.ejecutado / r.contrato)::int))
      ELSE                    LEAST(60, GREATEST( 5, round(100 * r.ejecutado / r.contrato)::int))
    END
FROM (
  SELECT
    o.proyecto_id,
    round(GREATEST(COALESCE(SUM(o.monto_facturable_ars), 0), 2500000)
          * gannet_demo.sem_n(o.proyecto_id, 1601, 1.04, 1.16, 4), 2) AS contrato,
    COALESCE(SUM(o.monto_facturable_ars) FILTER (WHERE o.estado = 'completada'), 0) AS ejecutado
  FROM gannet_demo.ordenes_trabajo o
  WHERE o.proyecto_id IS NOT NULL
  GROUP BY o.proyecto_id
) r
WHERE r.proyecto_id = p.id;

-- =============================================================================
-- 15. ot_asignaciones — cuadrilla de cada orden de trabajo
-- El tamaño de cuadrilla se recalcula con la misma formula usada al costear la
-- orden, de modo que el costo de mano de obra imputado y la cantidad de gente
-- asignada cuenten la misma historia. Los integrantes se toman siempre del
-- plantel especializado en el servicio de la orden.
-- =============================================================================

INSERT INTO gannet_demo.ot_asignaciones (id, orden_trabajo_id, empleado_id, rol_en_ot, horas)
OVERRIDING SYSTEM VALUE
SELECT
  row_number() OVER (ORDER BY t.ot_id, t.j),
  t.ot_id,
  emp.id,
  CASE
    WHEN t.j = 1 THEN 'supervisor'
    WHEN t.srv_idx = 6 AND t.j = 2 THEN 'chofer'
    WHEN t.j = 2 THEN 'tecnico'
    WHEN t.j = 3 THEN 'operario'
    WHEN t.j = 4 THEN 'ayudante'
    ELSE 'seguridad'
  END,
  CASE WHEN t.horas_reales IS NOT NULL
       THEN round(t.horas_reales * gannet_demo.sem_n(t.ot_id * 10 + t.j, 1501, 0.85, 1.08, 4), 2)
       ELSE NULL END
FROM (
  SELECT
    o.id AS ot_id,
    o.servicio_id,
    s.idx AS srv_idx,
    o.horas_reales,
    gs.j
  FROM gannet_demo.ordenes_trabajo o
  JOIN tmp_srv s ON s.id = o.servicio_id
  CROSS JOIN LATERAL generate_series(
    1,
    gannet_demo.sem_i(o.id, 1213,
      (ARRAY[1,2,2,1,2,1,1,2,3,2])[s.idx],
      (ARRAY[3,4,3,2,4,2,2,4,5,3])[s.idx])
  ) AS gs(j)
  WHERE o.estado <> 'borrador'
) t
JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.especialidad_servicio_id = t.servicio_id AND e.estado <> 'baja'
  ORDER BY gannet_demo.sem_h(e.id, 15000 + t.ot_id), e.id
  OFFSET (t.j - 1) LIMIT 1
) emp ON true;

-- =============================================================================
-- 16. turnos — parte diario de los ultimos 90 dias
-- Se genera la grilla completa empleado x dia, lo que satisface por
-- construccion la unicidad (empleado, fecha, turno). Cuando ese dia existia una
-- orden de trabajo del servicio en que el empleado esta especializado, el turno
-- se imputa a esa orden y hereda su faena; si no, el empleado trabajo en base
-- propia y la faena queda nula, tal como describe el modelo.
-- =============================================================================

INSERT INTO gannet_demo.turnos (id, empleado_id, faena_id, orden_trabajo_id, fecha, turno, horas, estado)
OVERRIDING SYSTEM VALUE
SELECT
  row_number() OVER (ORDER BY t.empleado_id, t.fecha),
  t.empleado_id,
  ot.faena_id,
  ot.id,
  t.fecha,
  t.turno,
  t.horas,
  t.estado
FROM (
  SELECT
    e.id AS empleado_id,
    e.especialidad_servicio_id,
    (CURRENT_DATE - g.d)::date AS fecha,
    (ARRAY['mañana','mañana','mañana','tarde','tarde','noche'])
      [1 + gannet_demo.sem_h(e.id * 1000 + g.d, 1701) % 6] AS turno,
    CASE
      WHEN gannet_demo.sem_h(e.id * 1000 + g.d, 1702) % 1000 < 40  THEN 'licencia'
      WHEN gannet_demo.sem_h(e.id * 1000 + g.d, 1702) % 1000 < 75  THEN 'ausente'
      WHEN gannet_demo.sem_h(e.id * 1000 + g.d, 1702) % 1000 < 80  THEN 'accidente'
      WHEN extract(isodow FROM (CURRENT_DATE - g.d)) >= 6
           AND gannet_demo.sem_h(e.id * 1000 + g.d, 1703) % 100 < 62 THEN 'franco'
      WHEN gannet_demo.sem_h(e.id * 1000 + g.d, 1703) % 1000 < 55  THEN 'franco'
      ELSE 'presente'
    END AS estado,
    CASE
      WHEN gannet_demo.sem_h(e.id * 1000 + g.d, 1702) % 1000 < 80 THEN 0.0
      WHEN extract(isodow FROM (CURRENT_DATE - g.d)) >= 6
           AND gannet_demo.sem_h(e.id * 1000 + g.d, 1703) % 100 < 62 THEN 0.0
      WHEN gannet_demo.sem_h(e.id * 1000 + g.d, 1703) % 1000 < 55 THEN 0.0
      ELSE gannet_demo.sem_n(e.id * 1000 + g.d, 1704, 7.5, 12.0, 1)
    END AS horas
  FROM gannet_demo.empleados e
  CROSS JOIN generate_series(0, 89) AS g(d)
  WHERE e.estado <> 'baja'
) t
LEFT JOIN LATERAL (
  SELECT o.id, o.faena_id
  FROM gannet_demo.ordenes_trabajo o
  WHERE o.fecha_programada = t.fecha
    AND o.servicio_id = t.especialidad_servicio_id
    AND o.estado IN ('completada','en_ejecucion','pausada')
  ORDER BY gannet_demo.sem_h(o.id, t.empleado_id), o.id
  LIMIT 1
) ot ON t.estado = 'presente';

-- =============================================================================
-- 17. cotizaciones — 420 propuestas comerciales
-- Las 126 primeras se derivan de un proyecto real: son las propuestas que se
-- ganaron. Por eso toda cotizacion aceptada tiene proyecto asociado, cliente
-- coincidente y fecha de emision anterior al inicio del contrato.
-- Las restantes son propuestas sueltas, con fechas coherentes con su estado:
-- una cotizacion vigente nunca esta vencida y una vencida siempre lo esta.
-- =============================================================================

INSERT INTO gannet_demo.cotizaciones (
  id, numero, cliente_id, contacto_id, proyecto_id, servicio_principal_id,
  responsable_comercial_id, estado, fecha_emision, fecha_validez,
  subtotal_ars, descuento_pct, impuestos_ars, total_ars, probabilidad_pct, motivo_rechazo
)
OVERRIDING SYSTEM VALUE
SELECT
  q.i,
  'COT-' || to_char(q.emision, 'YYYY') || '-' || lpad(q.i::text, 4, '0'),
  q.cliente_id,
  ct.contacto_id,
  q.proyecto_id,
  q.servicio_id,
  com.id,
  q.estado,
  q.emision,
  (q.emision + (ARRAY[30, 45, 60])[1 + gannet_demo.sem_h(q.i, 1801) % 3])::date,
  0, gannet_demo.sem_n(q.i, 1802, 0, 12, 2), 0, 0,
  CASE q.estado
    WHEN 'aceptada'       THEN 100
    WHEN 'rechazada'      THEN 0
    WHEN 'en_negociacion' THEN gannet_demo.sem_i(q.i, 1803, 45, 85)
    WHEN 'enviada'        THEN gannet_demo.sem_i(q.i, 1803, 20, 60)
    WHEN 'vencida'        THEN gannet_demo.sem_i(q.i, 1803, 10, 40)
    ELSE                       gannet_demo.sem_i(q.i, 1803,  5, 25)
  END,
  CASE WHEN q.estado = 'rechazada'
       THEN (ARRAY['Precio por encima del presupuesto del cliente',
                   'Se adjudicó a un proveedor con contrato marco vigente',
                   'El cliente postergó la inversión al ejercicio siguiente',
                   'Plazo de ejecución ofrecido superior al requerido',
                   'Alcance técnico no cubría la totalidad del requerimiento'])
              [1 + gannet_demo.sem_h(q.i, 1804) % 5]
       ELSE NULL END
FROM (
  SELECT
    b.i, b.cliente_id, b.servicio_id, b.proyecto_id, b.estado,
    CASE b.estado
      WHEN 'aceptada'       THEN (b.p_ini - gannet_demo.sem_i(b.i, 1810, 15, 70))::date
      WHEN 'vencida'        THEN (CURRENT_DATE - gannet_demo.sem_i(b.i, 1810, 80, 500))::date
      WHEN 'rechazada'      THEN (CURRENT_DATE - gannet_demo.sem_i(b.i, 1810, 25, 480))::date
      WHEN 'en_negociacion' THEN (CURRENT_DATE - gannet_demo.sem_i(b.i, 1810,  3,  28))::date
      WHEN 'enviada'        THEN (CURRENT_DATE - gannet_demo.sem_i(b.i, 1810,  1,  22))::date
      ELSE                       (CURRENT_DATE - gannet_demo.sem_i(b.i, 1810,  0,  16))::date
    END AS emision
  FROM (
    SELECT
      a.i,
      COALESCE(p.cliente_id, pc.cliente_id)   AS cliente_id,
      COALESCE(p.servicio_id, ssrv.id)        AS servicio_id,
      p.id                                    AS proyecto_id,
      COALESCE(p.fecha_inicio_real, p.fecha_inicio_plan) AS p_ini,
      CASE
        WHEN a.i <= 126 THEN 'aceptada'
        WHEN gannet_demo.sem_h(a.i, 1820) % 100 < 31 THEN 'rechazada'
        WHEN gannet_demo.sem_h(a.i, 1820) % 100 < 53 THEN 'enviada'
        WHEN gannet_demo.sem_h(a.i, 1820) % 100 < 73 THEN 'en_negociacion'
        WHEN gannet_demo.sem_h(a.i, 1820) % 100 < 89 THEN 'vencida'
        ELSE 'borrador'
      END AS estado
    FROM generate_series(1, 420) AS a(i)
    LEFT JOIN tmp_peso_proyecto pp
      ON a.i <= 126
     AND gannet_demo.sem_r(a.i, 1830) >= pp.lo AND gannet_demo.sem_r(a.i, 1830) < pp.hi
    LEFT JOIN gannet_demo.proyectos p ON p.id = pp.proyecto_id
    LEFT JOIN tmp_peso_cliente pc
      ON a.i > 126
     AND gannet_demo.sem_r(a.i, 1831) >= pc.lo AND gannet_demo.sem_r(a.i, 1831) < pc.hi
    LEFT JOIN tmp_peso_servicio ps
      ON a.i > 126
     AND gannet_demo.sem_r(a.i, 1832) >= ps.lo AND gannet_demo.sem_r(a.i, 1832) < ps.hi
    LEFT JOIN tmp_srv ssrv ON ssrv.idx = ps.idx
  ) b
) q
LEFT JOIN tmp_contacto ct
  ON ct.cliente_id = q.cliente_id
 AND ct.n = 1 + gannet_demo.sem_h(q.i, 1840) % ct.total
LEFT JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.area = 'comercial' AND e.estado = 'activo'
  ORDER BY gannet_demo.sem_h(e.id, 18500 + q.i), e.id
  LIMIT 1
) com ON true;

-- -----------------------------------------------------------------------------
-- cotizacion_items — renglones. El primero cotiza siempre el servicio principal
-- de la propuesta; los demas son servicios complementarios. La cantidad y el
-- precio unitario se expresan en la unidad de facturacion real del servicio.
-- -----------------------------------------------------------------------------

INSERT INTO gannet_demo.cotizacion_items (
  id, cotizacion_id, servicio_id, descripcion, cantidad, unidad, precio_unitario_ars, total_ars, orden
)
OVERRIDING SYSTEM VALUE
SELECT
  row_number() OVER (ORDER BY x.cotizacion_id, x.j),
  x.cotizacion_id,
  x.servicio_id,
  -- PROVISIONAL: lo reemplaza gannet_demo.aplicar_catalogo_textos() en 25.b.
  -- Esta linea producia 10 descripciones distintas para 1.448 renglones.
  '(pendiente de catalogo) ' || x.nombre_servicio,
  x.cantidad,
  x.unidad,
  x.precio,
  round(x.cantidad * x.precio, 2),
  x.j
FROM (
  SELECT
    c.id AS cotizacion_id,
    gs.j,
    sv.id AS servicio_id,
    sv.nombre AS nombre_servicio,
    sv.unidad_facturacion AS unidad,
    CASE sv.unidad_facturacion
      WHEN 'hora'     THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 60, 900, 2)
      WHEN 'jornada'  THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 6, 110, 2)
      WHEN 'mes'      THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 1, 14, 2)
      WHEN 'km'       THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 800, 26000, 2)
      WHEN 'm3'       THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 250, 19000, 2)
      WHEN 'm2'       THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 120, 8000, 2)
      WHEN 'tonelada' THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 20, 2200, 2)
      WHEN 'unidad'   THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1901, 1, 60, 2)
      ELSE 1.00
    END AS cantidad,
    CASE sv.unidad_facturacion
      WHEN 'hora'     THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 38000, 74000, 2)
      WHEN 'jornada'  THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 380000, 980000, 2)
      WHEN 'mes'      THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 18000000, 54000000, 2)
      WHEN 'km'       THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 2600, 6400, 2)
      WHEN 'm3'       THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 24000, 64000, 2)
      WHEN 'm2'       THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 46000, 120000, 2)
      WHEN 'tonelada' THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 88000, 240000, 2)
      WHEN 'unidad'   THEN gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 900000, 6500000, 2)
      ELSE                 gannet_demo.sem_n(c.id * 10 + gs.j, 1902, 32000000, 920000000, 2)
    END AS precio
  FROM gannet_demo.cotizaciones c
  CROSS JOIN LATERAL generate_series(1, 2 + (gannet_demo.sem_h(c.id, 1903) % 4)::int) AS gs(j)
  JOIN tmp_srv sv
    ON sv.id = CASE WHEN gs.j = 1 THEN c.servicio_principal_id ELSE NULL END
    OR (gs.j > 1 AND sv.idx = 1 + gannet_demo.sem_h(c.id * 10 + gs.j, 1904) % 10)
) x;

-- Cierre economico de la cotizacion a partir de sus renglones.
UPDATE gannet_demo.cotizaciones c
SET subtotal_ars  = r.subtotal,
    impuestos_ars = round(r.subtotal * (1 - c.descuento_pct / 100) * 0.21, 2),
    total_ars     = round(r.subtotal * (1 - c.descuento_pct / 100) * 1.21, 2)
FROM (
  SELECT cotizacion_id, SUM(total_ars) AS subtotal
  FROM gannet_demo.cotizacion_items GROUP BY cotizacion_id
) r
WHERE r.cotizacion_id = c.id;

-- =============================================================================
-- 18. facturas — 980 comprobantes
-- Tres origenes, todos trazables: 620 por orden de trabajo terminada, 300 por
-- certificacion de avance de proyecto y 60 notas de credito o debito.
-- Reglas de cobranza respetadas de punta a punta:
--   * solo el estado 'cobrada' lleva fecha de cobro, y siempre posterior o
--     igual a la emision y nunca futura;
--   * las vencidas tienen vencimiento en el pasado y ningun cobro;
--   * el cliente moroso concentra deliberadamente los comprobantes vencidos.
-- =============================================================================

DROP TABLE IF EXISTS tmp_ot_facturable;
CREATE TEMP TABLE tmp_ot_facturable AS
SELECT
  row_number() OVER (ORDER BY gannet_demo.sem_h(o.id, 2001), o.id) AS n,
  o.id AS ot_id, o.cliente_id, o.proyecto_id, o.monto_facturable_ars,
  o.fecha_fin::date AS fecha_fin
FROM gannet_demo.ordenes_trabajo o
WHERE o.estado = 'completada' AND o.monto_facturable_ars IS NOT NULL;

CREATE UNIQUE INDEX ON tmp_ot_facturable (n);

-- Proyectos facturables: los que ya arrancaron. Reparto de Pareto propio.
DROP TABLE IF EXISTS tmp_peso_proy_fact;
CREATE TEMP TABLE tmp_peso_proy_fact AS
WITH w AS (
  SELECT p.id AS proyecto_id, p.cliente_id,
         COALESCE(p.fecha_inicio_real, p.fecha_inicio_plan) AS ini,
         1 + 3000 / (row_number() OVER (ORDER BY p.id) + 8) AS peso
  FROM gannet_demo.proyectos p
  WHERE p.estado <> 'planificado'
)
SELECT proyecto_id, cliente_id, ini,
  (SUM(peso) OVER (ORDER BY proyecto_id ROWS UNBOUNDED PRECEDING) - peso)::numeric
    / SUM(peso) OVER ()::numeric AS lo,
  SUM(peso) OVER (ORDER BY proyecto_id ROWS UNBOUNDED PRECEDING)::numeric
    / SUM(peso) OVER ()::numeric AS hi
FROM w;

CREATE INDEX ON tmp_peso_proy_fact (lo, hi);

INSERT INTO gannet_demo.facturas (
  id, numero, tipo_comprobante, cliente_id, proyecto_id, orden_trabajo_id, cotizacion_id,
  estado, fecha_emision, fecha_vencimiento, fecha_cobro, neto_ars, iva_ars, total_ars
)
OVERRIDING SYSTEM VALUE
SELECT
  z.i,
  CASE z.tipo WHEN 'nota_credito' THEN 'NC' WHEN 'nota_debito' THEN 'ND' ELSE 'FA' END
    || '-0001-' || lpad(z.i::text, 8, '0'),
  z.tipo,
  z.cliente_id,
  z.proyecto_id,
  z.ot_id,
  cot.id,
  z.estado,
  z.emision,
  z.vencimiento,
  CASE WHEN z.estado = 'cobrada'
       THEN LEAST(z.emision + gannet_demo.sem_i(z.i, 2010, 3, z.cond_pago + 20), CURRENT_DATE)
       ELSE NULL END,
  z.neto,
  round(z.neto * 0.21, 2),
  round(z.neto * 1.21, 2)
FROM (
  SELECT
    y.*,
    (y.emision + y.cond_pago)::date AS vencimiento,
    CASE
      WHEN y.tipo IN ('nota_credito','nota_debito') THEN 'emitida'
      WHEN (y.emision + y.cond_pago) < CURRENT_DATE THEN
        CASE
          WHEN y.cliente_moroso THEN
            CASE WHEN gannet_demo.sem_h(y.i, 2020) % 100 < 88 THEN 'vencida' ELSE 'cobrada' END
          WHEN gannet_demo.sem_h(y.i, 2020) % 100 < 79 THEN 'cobrada'
          WHEN gannet_demo.sem_h(y.i, 2020) % 100 < 97 THEN 'vencida'
          ELSE 'anulada'
        END
      ELSE
        CASE
          WHEN gannet_demo.sem_h(y.i, 2020) % 100 < 40 THEN 'cobrada'
          WHEN gannet_demo.sem_h(y.i, 2020) % 100 < 82 THEN 'enviada'
          ELSE 'emitida'
        END
    END AS estado
  FROM (
    SELECT
      g.i,
      CASE
        WHEN g.i > 920 THEN
          CASE WHEN gannet_demo.sem_h(g.i, 2030) % 100 < 70 THEN 'nota_credito' ELSE 'nota_debito' END
        WHEN gannet_demo.sem_h(g.i, 2030) % 100 < 88 THEN 'factura_a'
        WHEN gannet_demo.sem_h(g.i, 2030) % 100 < 96 THEN 'factura_b'
        ELSE 'factura_c'
      END AS tipo,
      COALESCE(otf.cliente_id, pf.cliente_id) AS cliente_id,
      COALESCE(otf.proyecto_id, pf.proyecto_id) AS proyecto_id,
      otf.ot_id,
      cl.estado = 'moroso' AS cliente_moroso,
      COALESCE(cl.condicion_pago_dias, 30) AS cond_pago,
      CASE
        WHEN otf.ot_id IS NOT NULL
          THEN LEAST(otf.fecha_fin + gannet_demo.sem_i(g.i, 2040, 1, 14), CURRENT_DATE)
        ELSE GREATEST(pf.ini, CURRENT_DATE - gannet_demo.sem_i(g.i, 2040, 0, 470))
      END AS emision,
      CASE
        WHEN otf.ot_id IS NOT NULL THEN otf.monto_facturable_ars
        WHEN g.i > 920 THEN gannet_demo.sem_n(g.i, 2050, 900000, 28000000, 2)
        ELSE gannet_demo.sem_n(g.i, 2050, 18000000, 320000000, 2)
      END AS neto
    FROM generate_series(1, 980) AS g(i)
    LEFT JOIN tmp_ot_facturable otf ON g.i <= 620 AND otf.n = g.i
    LEFT JOIN tmp_peso_proy_fact pf
      ON g.i > 620
     AND gannet_demo.sem_r(g.i, 2060) >= pf.lo AND gannet_demo.sem_r(g.i, 2060) < pf.hi
    JOIN gannet_demo.clientes cl ON cl.id = COALESCE(otf.cliente_id, pf.cliente_id)
  ) y
) z
LEFT JOIN LATERAL (
  SELECT c.id FROM gannet_demo.cotizaciones c
  WHERE c.proyecto_id = z.proyecto_id AND c.estado = 'aceptada'
  ORDER BY c.id LIMIT 1
) cot ON z.proyecto_id IS NOT NULL;

-- =============================================================================
-- 19. ordenes_compra — 640 ordenes a proveedores, con sus renglones
-- Coherencias sostenidas: el rubro del proveedor determina si la compra es de
-- catalogo o de un servicio subcontratado; cuando la orden nace de una OT, se
-- imputa al mismo proyecto que esa OT; y solo las recibidas llevan fecha de
-- recepcion.
-- =============================================================================

INSERT INTO gannet_demo.ordenes_compra (
  id, numero, proveedor_id, proyecto_id, orden_trabajo_id, solicitante_id,
  deposito_destino_id, estado, fecha_emision, fecha_entrega_estimada, fecha_recepcion, total_ars
)
OVERRIDING SYSTEM VALUE
SELECT
  w.i,
  'OC-' || to_char(w.emision, 'YYYY') || '-' || lpad(w.i::text, 5, '0'),
  w.proveedor_id,
  COALESCE(ot.proyecto_id, pf.proyecto_id),
  ot.id,
  sol.id,
  w.deposito,
  w.estado,
  w.emision,
  w.entrega_est,
  CASE WHEN w.estado IN ('recibida','recibida_parcial')
       THEN LEAST(w.entrega_est + gannet_demo.sem_i(w.i, 2110, -4, 22), CURRENT_DATE)
       ELSE NULL END,
  0
FROM (
  SELECT
    v.*,
    (v.emision + gannet_demo.sem_i(v.i, 2120, 7, 45))::date AS entrega_est,
    CASE
      WHEN v.emision < CURRENT_DATE - 35 THEN
        CASE
          WHEN gannet_demo.sem_h(v.i, 2130) % 100 < 79 THEN 'recibida'
          WHEN gannet_demo.sem_h(v.i, 2130) % 100 < 88 THEN 'recibida_parcial'
          WHEN gannet_demo.sem_h(v.i, 2130) % 100 < 94 THEN 'cancelada'
          ELSE 'enviada'
        END
      ELSE
        CASE
          WHEN gannet_demo.sem_h(v.i, 2130) % 100 < 45 THEN 'enviada'
          WHEN gannet_demo.sem_h(v.i, 2130) % 100 < 78 THEN 'aprobada'
          ELSE 'borrador'
        END
    END AS estado
  FROM (
    SELECT
      g.i,
      1 + gannet_demo.sem_h(g.i, 2140) % 40 AS proveedor_id,
      1 + gannet_demo.sem_h(g.i, 2141) % 8  AS deposito,
      cal.fecha AS emision,
      CASE WHEN gannet_demo.sem_h(g.i, 2142) % 100 < 26 THEN true ELSE false END AS nace_de_ot
    FROM generate_series(1, 640) AS g(i)
    JOIN tmp_calendario cal
      ON gannet_demo.sem_r(g.i, 2143) >= cal.lo AND gannet_demo.sem_r(g.i, 2143) < cal.hi
  ) v
) w
LEFT JOIN LATERAL (
  SELECT o.id, o.proyecto_id FROM gannet_demo.ordenes_trabajo o
  WHERE o.fecha_programada BETWEEN w.emision - 20 AND w.emision + 40
    AND o.estado <> 'borrador'
  ORDER BY gannet_demo.sem_h(o.id, 21500 + w.i), o.id
  LIMIT 1
) ot ON w.nace_de_ot
LEFT JOIN LATERAL (
  SELECT pp.proyecto_id FROM tmp_peso_proy_fact pp
  WHERE gannet_demo.sem_r(w.i, 2160) >= pp.lo AND gannet_demo.sem_r(w.i, 2160) < pp.hi
) pf ON NOT w.nace_de_ot AND gannet_demo.sem_h(w.i, 2161) % 100 < 68
LEFT JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.area IN ('deposito','logistica','mantenimiento') AND e.estado = 'activo'
  ORDER BY gannet_demo.sem_h(e.id, 21700 + w.i), e.id
  LIMIT 1
) sol ON true;

INSERT INTO gannet_demo.orden_compra_items (
  id, orden_compra_id, articulo_id, descripcion, cantidad, precio_unitario_ars, total_ars
)
OVERRIDING SYSTEM VALUE
SELECT
  row_number() OVER (ORDER BY k.oc_id, k.j),
  k.oc_id,
  art.id,
  COALESCE(art.descripcion,
    (ARRAY['Servicio subcontratado de montaje según especificación técnica',
           'Provisión de mano de obra especializada por jornada',
           'Alquiler mensual de equipo con mantenimiento incluido',
           'Servicio de flete especial hasta faena',
           'Ensayo no destructivo y emisión de protocolo',
           'Calibración de instrumental con certificado trazable'])
      [1 + gannet_demo.sem_h(k.oc_id * 10 + k.j, 2210) % 6]),
  k.cantidad,
  p.precio,
  round(k.cantidad * p.precio, 2)
FROM (
  SELECT
    oc.id AS oc_id,
    gs.j,
    pr.rubro,
    CASE WHEN pr.rubro IN ('subcontrato','servicios','alquileres','logistica')
         THEN gannet_demo.sem_n(oc.id * 10 + gs.j, 2220, 1, 30, 2)
         ELSE gannet_demo.sem_n(oc.id * 10 + gs.j, 2220, 2, 90, 2) END AS cantidad,
    CASE WHEN pr.rubro IN ('subcontrato','servicios','alquileres','logistica')
         THEN gannet_demo.sem_n(oc.id * 10 + gs.j, 2221, 850000, 24000000, 2)
         ELSE NULL END AS precio_serv
  FROM gannet_demo.ordenes_compra oc
  JOIN gannet_demo.proveedores pr ON pr.id = oc.proveedor_id
  CROSS JOIN LATERAL generate_series(1, 1 + (gannet_demo.sem_h(oc.id, 2230) % 4)::int) AS gs(j)
) k
LEFT JOIN LATERAL (
  SELECT a.id, a.descripcion, a.costo_unitario_ars
  FROM gannet_demo.articulos a
  WHERE a.categoria = ANY (
          CASE k.rubro
            WHEN 'materiales'  THEN ARRAY['ferreteria','electrico','quimico']
            WHEN 'repuestos'   THEN ARRAY['repuesto']
            WHEN 'combustible' THEN ARRAY['combustible','lubricante']
            WHEN 'epp'         THEN ARRAY['epp']
            ELSE ARRAY['consumible','papeleria']
          END)
  ORDER BY gannet_demo.sem_h(a.id, 22400 + k.oc_id * 10 + k.j), a.id
  LIMIT 1
) art ON k.rubro NOT IN ('subcontrato','servicios','alquileres','logistica')
CROSS JOIN LATERAL (
  SELECT COALESCE(
           round(art.costo_unitario_ars * gannet_demo.sem_n(k.oc_id * 10 + k.j, 2250, 0.92, 1.22, 4), 2),
           k.precio_serv) AS precio
) p;

UPDATE gannet_demo.ordenes_compra oc
SET total_ars = r.total
FROM (
  SELECT orden_compra_id, SUM(total_ars) AS total
  FROM gannet_demo.orden_compra_items GROUP BY orden_compra_id
) r
WHERE r.orden_compra_id = oc.id;

-- =============================================================================
-- 20. movimientos_stock — 400 movimientos con origen trazable
-- Ningun movimiento es inventado: los ingresos provienen de renglones de
-- ordenes de compra efectivamente recibidas y entran al deposito de destino de
-- esa orden; los egresos se imputan a ordenes de trabajo completadas y salen de
-- un deposito donde el articulo realmente tiene existencia.
-- =============================================================================

INSERT INTO gannet_demo.movimientos_stock (
  id, articulo_id, deposito_id, tipo, cantidad, orden_trabajo_id, orden_compra_id,
  empleado_id, fecha, observacion
)
OVERRIDING SYSTEM VALUE
SELECT
  row_number() OVER (ORDER BY m.orden, m.n),
  m.articulo_id, m.deposito_id, m.tipo, m.cantidad,
  m.orden_trabajo_id, m.orden_compra_id, m.empleado_id, m.fecha, m.observacion
FROM (
  -- Ingresos por recepcion de compra
  SELECT
    1 AS orden, x.n,
    x.articulo_id, x.deposito_id,
    'ingreso'::text AS tipo,
    x.cantidad,
    NULL::bigint AS orden_trabajo_id,
    x.oc_id AS orden_compra_id,
    x.solicitante_id AS empleado_id,
    x.fecha_recepcion::timestamptz + INTERVAL '10 hours' AS fecha,
    'Recepción de mercadería contra orden de compra ' || x.numero AS observacion
  FROM (
    SELECT
      row_number() OVER (ORDER BY gannet_demo.sem_h(i.id, 2301), i.id) AS n,
      i.articulo_id, oc.deposito_destino_id AS deposito_id, i.cantidad,
      oc.id AS oc_id, oc.numero, oc.solicitante_id, oc.fecha_recepcion
    FROM gannet_demo.orden_compra_items i
    JOIN gannet_demo.ordenes_compra oc ON oc.id = i.orden_compra_id
    WHERE i.articulo_id IS NOT NULL
      AND oc.estado IN ('recibida','recibida_parcial')
      AND oc.fecha_recepcion IS NOT NULL
      AND oc.deposito_destino_id IS NOT NULL
  ) x
  WHERE x.n <= 200

  UNION ALL

  -- Egresos por consumo en orden de trabajo
  SELECT
    2 AS orden, y.n,
    st.articulo_id, st.deposito_id,
    'egreso'::text,
    -gannet_demo.sem_n(y.ot_id, 2310, 1, 26, 2),
    y.ot_id,
    NULL::bigint,
    y.responsable_id,
    y.fecha_fin,
    'Consumo de materiales imputado a la orden ' || y.numero
  FROM (
    SELECT
      row_number() OVER (ORDER BY gannet_demo.sem_h(o.id, 2311), o.id) AS n,
      o.id AS ot_id, o.numero, o.responsable_id, o.fecha_fin
    FROM gannet_demo.ordenes_trabajo o
    WHERE o.estado = 'completada' AND o.fecha_fin IS NOT NULL
  ) y
  JOIN LATERAL (
    SELECT s.articulo_id, s.deposito_id
    FROM gannet_demo.stock s
    WHERE s.cantidad > 0
    ORDER BY gannet_demo.sem_h(s.id, 23200 + y.ot_id), s.id
    LIMIT 1
  ) st ON true
  WHERE y.n <= 200
) m;

-- =============================================================================
-- 21. mantenimientos — 300 intervenciones sobre activos propios
-- Cada registro refiere a un vehiculo o a un equipo, nunca a ambos, tal como
-- exige el CHECK del esquema. El tipo de intervencion sigue a la naturaleza del
-- activo: verificacion tecnica solo en vehiculos, calibracion solo en
-- instrumental de medicion.
-- =============================================================================

INSERT INTO gannet_demo.mantenimientos (
  id, vehiculo_id, equipo_id, proveedor_id, responsable_id, tipo, estado,
  fecha, fecha_fin, km_odometro, costo_ars, descripcion
)
OVERRIDING SYSTEM VALUE
SELECT
  n.i,
  n.vehiculo_id,
  n.equipo_id,
  prov.id,
  resp.id,
  t.tipo,
  n.estado,
  n.fecha,
  CASE WHEN n.estado = 'completado'
       THEN LEAST(n.fecha + gannet_demo.sem_i(n.i, 2401, 1, 12), CURRENT_DATE)
       ELSE NULL END,
  CASE WHEN n.vehiculo_id IS NOT NULL
       THEN GREATEST(v.km_actual - gannet_demo.sem_i(n.i, 2402, 0, 60000), 1200)
       ELSE NULL END,
  CASE WHEN n.vehiculo_id IS NOT NULL
       THEN gannet_demo.sem_n(n.i, 2403, 850000, 24000000, 2)
       ELSE gannet_demo.sem_n(n.i, 2403, 320000, 9500000, 2) END,
  CASE t.tipo
    WHEN 'vtv'         THEN 'Verificación técnica vehicular obligatoria y gestión de oblea.'
    WHEN 'calibracion' THEN 'Calibración con patrones trazables y emisión de certificado.'
    WHEN 'service'     THEN 'Service de rutina: aceite, filtros, frenos y control general.'
    WHEN 'preventivo'  THEN 'Mantenimiento preventivo según plan y horas de uso acumuladas.'
    ELSE                    'Reparación correctiva por falla detectada en operación.'
  END
FROM (
  SELECT
    b.*,
    CASE
      WHEN b.fecha > CURRENT_DATE THEN 'programado'
      WHEN b.fecha >= CURRENT_DATE - 6 THEN 'en_taller'
      WHEN gannet_demo.sem_h(b.i, 2410) % 100 < 92 THEN 'completado'
      ELSE 'cancelado'
    END AS estado
  FROM (
    SELECT
      g.i,
      CASE WHEN g.i <= 180 THEN (1 + gannet_demo.sem_h(g.i, 2420) % 45)::bigint ELSE NULL END AS vehiculo_id,
      CASE WHEN g.i >  180 THEN (1 + gannet_demo.sem_h(g.i, 2421) % 280)::bigint ELSE NULL END AS equipo_id,
      (CURRENT_DATE - gannet_demo.sem_i(g.i, 2422, -45, 500))::date AS fecha
    FROM generate_series(1, 300) AS g(i)
  ) b
) n
LEFT JOIN gannet_demo.vehiculos v ON v.id = n.vehiculo_id
LEFT JOIN gannet_demo.equipos  eq ON eq.id = n.equipo_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN eq.categoria = 'instrumento_medicion' THEN 'calibracion'
    WHEN n.vehiculo_id IS NOT NULL AND gannet_demo.sem_h(n.i, 2430) % 100 < 18 THEN 'vtv'
    WHEN n.vehiculo_id IS NOT NULL AND gannet_demo.sem_h(n.i, 2430) % 100 < 58 THEN 'service'
    WHEN gannet_demo.sem_h(n.i, 2430) % 100 < 76 THEN 'preventivo'
    ELSE 'correctivo'
  END AS tipo
) t
LEFT JOIN LATERAL (
  SELECT pr.id FROM gannet_demo.proveedores pr
  WHERE pr.rubro IN ('servicios','repuestos') AND pr.activo
  ORDER BY gannet_demo.sem_h(pr.id, 24400 + n.i), pr.id
  LIMIT 1
) prov ON gannet_demo.sem_h(n.i, 2441) % 100 < 72
LEFT JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.area IN ('mantenimiento','logistica','deposito') AND e.estado = 'activo'
  ORDER BY gannet_demo.sem_h(e.id, 24500 + n.i), e.id
  LIMIT 1
) resp ON true;

-- =============================================================================
-- 22. actividades — 5.000 registros de bitacora
-- Cuatro bloques segun a que se vinculan. Todos llevan cliente, de modo que se
-- satisface siempre el CHECK que exige al menos un vinculo de negocio, y la
-- fecha de cada actividad es coherente con la del objeto al que refiere.
-- =============================================================================

INSERT INTO gannet_demo.actividades (
  id, tipo, titulo, descripcion, cliente_id, contacto_id, proyecto_id,
  orden_trabajo_id, cotizacion_id, autor_id, fecha, estado
)
OVERRIDING SYSTEM VALUE
SELECT
  row_number() OVER (ORDER BY a.bloque, a.k),
  a.tipo,
  a.titulo,
  a.descripcion,
  a.cliente_id,
  ct.contacto_id,
  a.proyecto_id,
  a.orden_trabajo_id,
  a.cotizacion_id,
  aut.id,
  a.fecha,
  CASE
    WHEN a.fecha > CURRENT_DATE::timestamptz THEN 'pendiente'
    WHEN gannet_demo.sem_h(a.bloque * 100000 + a.k, 2501) % 100 < 84 THEN 'completada'
    WHEN gannet_demo.sem_h(a.bloque * 100000 + a.k, 2501) % 100 < 92 THEN 'pendiente'
    WHEN gannet_demo.sem_h(a.bloque * 100000 + a.k, 2501) % 100 < 97 THEN 'en_curso'
    ELSE 'cancelada'
  END AS estado
FROM (
  -- Bloque 1: seguimiento de ordenes de trabajo
  SELECT
    1 AS bloque, g.k,
    (ARRAY['nota','cambio_estado','alerta','tarea','visita'])
      [1 + gannet_demo.sem_h(g.k, 2510) % 5] AS tipo,
    (ARRAY['Registro de avance de la orden',
           'Cambio de estado de la orden de trabajo',
           'Alerta de desvío de horas sobre lo estimado',
           'Tarea pendiente asignada a la cuadrilla',
           'Visita de supervisión en faena'])
      [1 + gannet_demo.sem_h(g.k, 2510) % 5] || ' ' || o.numero AS titulo,
    'Actividad registrada sobre la orden de trabajo ' || o.numero
      || ' correspondiente al servicio contratado por el cliente.' AS descripcion,
    o.cliente_id, o.proyecto_id, o.id AS orden_trabajo_id, NULL::bigint AS cotizacion_id,
    (o.fecha_programada::timestamptz + (gannet_demo.sem_i(g.k, 2511, 7, 18) || ' hours')::interval) AS fecha
  FROM generate_series(1, 1500) AS g(k)
  JOIN gannet_demo.ordenes_trabajo o ON o.id = 1 + gannet_demo.sem_h(g.k, 2512) % 1350

  UNION ALL

  -- Bloque 2: gestion de proyectos
  SELECT
    2, g.k,
    (ARRAY['hito','reunion','alerta','nota','tarea'])[1 + gannet_demo.sem_h(g.k, 2520) % 5],
    (ARRAY['Hito de avance certificado',
           'Reunión de coordinación con el cliente',
           'Alerta de desvío de plazo contractual',
           'Registro de observación de obra',
           'Tarea de cierre documental'])
      [1 + gannet_demo.sem_h(g.k, 2520) % 5] || ' — ' || p.codigo,
    'Actividad de gestión del proyecto ' || p.codigo || ' — ' || p.nombre || '.',
    p.cliente_id, p.id, NULL::bigint, NULL::bigint,
    (COALESCE(p.fecha_inicio_real, p.fecha_inicio_plan)
       + gannet_demo.sem_i(g.k, 2521, 0,
           GREATEST(COALESCE(p.fecha_fin_real, p.fecha_fin_plan)
                    - COALESCE(p.fecha_inicio_real, p.fecha_inicio_plan), 1)))::timestamptz
      + (gannet_demo.sem_i(g.k, 2522, 8, 17) || ' hours')::interval
  FROM generate_series(1, 1200) AS g(k)
  JOIN gannet_demo.proyectos p ON p.id = 1 + gannet_demo.sem_h(g.k, 2523) % 80

  UNION ALL

  -- Bloque 3: embudo comercial
  SELECT
    3, g.k,
    (ARRAY['llamada','email','reunion','nota','tarea'])[1 + gannet_demo.sem_h(g.k, 2530) % 5],
    (ARRAY['Llamada de seguimiento de la propuesta',
           'Envío de la propuesta económica',
           'Reunión de negociación con el cliente',
           'Registro de objeción comercial',
           'Tarea de seguimiento comercial'])
      [1 + gannet_demo.sem_h(g.k, 2530) % 5] || ' — ' || c.numero,
    'Gestión comercial sobre la cotización ' || c.numero || '.',
    c.cliente_id, NULL::bigint, NULL::bigint, c.id,
    (c.fecha_emision + gannet_demo.sem_i(g.k, 2531, 0, 30))::timestamptz
      + (gannet_demo.sem_i(g.k, 2532, 9, 18) || ' hours')::interval
  FROM generate_series(1, 900) AS g(k)
  JOIN gannet_demo.cotizaciones c ON c.id = 1 + gannet_demo.sem_h(g.k, 2533) % 420

  UNION ALL

  -- Bloque 4: relacion con el cliente
  SELECT
    4, g.k,
    (ARRAY['llamada','visita','reunion','email','nota'])[1 + gannet_demo.sem_h(g.k, 2540) % 5],
    (ARRAY['Llamada de relevamiento de necesidades',
           'Visita comercial a la operación del cliente',
           'Reunión de revisión de servicio',
           'Envío de informe mensual de gestión',
           'Registro de novedad de la cuenta'])
      [1 + gannet_demo.sem_h(g.k, 2540) % 5] || ' — ' || cl.nombre_comercial,
    'Actividad de relación con el cliente ' || cl.razon_social || '.',
    cl.id, NULL::bigint, NULL::bigint, NULL::bigint,
    cal.fecha::timestamptz + (gannet_demo.sem_i(g.k, 2541, 8, 18) || ' hours')::interval
  FROM generate_series(1, 1400) AS g(k)
  JOIN tmp_peso_cliente pc
    ON gannet_demo.sem_r(g.k, 2542) >= pc.lo AND gannet_demo.sem_r(g.k, 2542) < pc.hi
  JOIN gannet_demo.clientes cl ON cl.id = pc.cliente_id
  JOIN tmp_calendario cal
    ON gannet_demo.sem_r(g.k, 2543) >= cal.lo AND gannet_demo.sem_r(g.k, 2543) < cal.hi
) a
LEFT JOIN tmp_contacto ct
  ON ct.cliente_id = a.cliente_id
 AND ct.n = 1 + gannet_demo.sem_h(a.bloque * 100000 + a.k, 2550) % ct.total
 AND gannet_demo.sem_h(a.bloque * 100000 + a.k, 2551) % 100 < 72
LEFT JOIN LATERAL (
  SELECT e.id FROM gannet_demo.empleados e
  WHERE e.estado = 'activo'
    AND e.area = CASE WHEN a.bloque = 3 OR a.bloque = 4 THEN 'comercial' ELSE 'operaciones' END
  ORDER BY gannet_demo.sem_h(e.id, 25600 + a.bloque * 100000 + a.k), e.id
  LIMIT 1
) aut ON true;

-- =============================================================================
-- 23. documentos — 800 archivos colgados de entidades reales
-- Los tipos con caducidad (habilitacion, poliza, certificado) llevan fecha de
-- vencimiento; el resto no. Una porcion vence dentro de los proximos 30 dias,
-- que es lo que alimenta el panel de documentacion por vencer.
-- =============================================================================

INSERT INTO gannet_demo.documentos (
  id, nombre, tipo, cliente_id, proyecto_id, orden_trabajo_id, empleado_id,
  vehiculo_id, equipo_id, fecha_emision, fecha_vencimiento, url_archivo, tamano_kb
)
OVERRIDING SYSTEM VALUE
SELECT
  d.id,
  d.nombre,
  d.tipo,
  d.cliente_id, d.proyecto_id, d.orden_trabajo_id, d.empleado_id, d.vehiculo_id, d.equipo_id,
  d.emision,
  CASE WHEN d.tipo IN ('habilitacion','poliza','certificado')
       THEN (CURRENT_DATE + gannet_demo.sem_i(d.id, 2601, -40, 400))::date
       ELSE NULL END,
  'https://almacenamiento.gannet.local/gannet-demo/' || d.tipo || '/'
    || lpad(d.id::text, 4, '0') || '.pdf',
  gannet_demo.sem_i(d.id, 2602, 45, 9800)
FROM (
  SELECT
    row_number() OVER (ORDER BY e.bloque, e.k) AS id,
    e.*
  FROM (
    SELECT 1 AS bloque, g.k,
      (ARRAY['contrato','habilitacion','informe','procedimiento'])[1 + gannet_demo.sem_h(g.k, 2610) % 4] AS tipo,
      (ARRAY['Contrato marco de servicios','Habilitación de contratista',
             'Informe mensual de gestión','Procedimiento de trabajo aprobado'])
        [1 + gannet_demo.sem_h(g.k, 2610) % 4] || ' — ' || cl.nombre_comercial AS nombre,
      cl.id AS cliente_id, NULL::bigint AS proyecto_id, NULL::bigint AS orden_trabajo_id,
      NULL::bigint AS empleado_id, NULL::bigint AS vehiculo_id, NULL::bigint AS equipo_id,
      (CURRENT_DATE - gannet_demo.sem_i(g.k, 2611, 20, 520))::date AS emision
    FROM generate_series(1, 140) AS g(k)
    JOIN gannet_demo.clientes cl ON cl.id = 1 + gannet_demo.sem_h(g.k, 2612) % 30

    UNION ALL

    SELECT 2, g.k,
      (ARRAY['plano','informe','certificado','contrato'])[1 + gannet_demo.sem_h(g.k, 2620) % 4],
      (ARRAY['Plano conforme a obra','Informe de avance certificado',
             'Certificado de conformidad de obra','Contrato de obra firmado'])
        [1 + gannet_demo.sem_h(g.k, 2620) % 4] || ' — ' || p.codigo,
      p.cliente_id, p.id, NULL, NULL, NULL, NULL,
      (COALESCE(p.fecha_inicio_real, p.fecha_inicio_plan)
         + gannet_demo.sem_i(g.k, 2621, 0, 90))::date
    FROM generate_series(1, 170) AS g(k)
    JOIN gannet_demo.proyectos p ON p.id = 1 + gannet_demo.sem_h(g.k, 2622) % 80

    UNION ALL

    SELECT 3, g.k,
      (ARRAY['remito','foto','informe','procedimiento'])[1 + gannet_demo.sem_h(g.k, 2630) % 4],
      (ARRAY['Remito de entrega','Registro fotográfico de la tarea',
             'Informe técnico de cierre','Permiso de trabajo firmado'])
        [1 + gannet_demo.sem_h(g.k, 2630) % 4] || ' — ' || o.numero,
      o.cliente_id, o.proyecto_id, o.id, NULL, NULL, NULL,
      o.fecha_programada
    FROM generate_series(1, 200) AS g(k)
    JOIN gannet_demo.ordenes_trabajo o ON o.id = 1 + gannet_demo.sem_h(g.k, 2632) % 1350

    UNION ALL

    SELECT 4, g.k,
      (ARRAY['certificado','habilitacion','informe'])[1 + gannet_demo.sem_h(g.k, 2640) % 3],
      (ARRAY['Certificado de capacitación','Habilitación para trabajo en altura',
             'Examen médico ocupacional'])
        [1 + gannet_demo.sem_h(g.k, 2640) % 3] || ' — legajo ' || em.legajo,
      NULL, NULL, NULL, em.id, NULL, NULL,
      (CURRENT_DATE - gannet_demo.sem_i(g.k, 2641, 15, 500))::date
    FROM generate_series(1, 120) AS g(k)
    JOIN gannet_demo.empleados em ON em.id = 1 + gannet_demo.sem_h(g.k, 2642) % 140

    UNION ALL

    SELECT 5, g.k,
      (ARRAY['poliza','habilitacion','manual'])[1 + gannet_demo.sem_h(g.k, 2650) % 3],
      (ARRAY['Póliza de seguro del vehículo','Verificación técnica vehicular',
             'Manual de servicio del fabricante'])
        [1 + gannet_demo.sem_h(g.k, 2650) % 3] || ' — dominio ' || ve.dominio,
      NULL, NULL, NULL, NULL, ve.id, NULL,
      (CURRENT_DATE - gannet_demo.sem_i(g.k, 2651, 10, 420))::date
    FROM generate_series(1, 100) AS g(k)
    JOIN gannet_demo.vehiculos ve ON ve.id = 1 + gannet_demo.sem_h(g.k, 2652) % 45

    UNION ALL

    SELECT 6, g.k,
      (ARRAY['certificado','manual'])[1 + gannet_demo.sem_h(g.k, 2660) % 2],
      (ARRAY['Certificado de calibración','Manual de operación del equipo'])
        [1 + gannet_demo.sem_h(g.k, 2660) % 2] || ' — ' || eq.codigo_interno,
      NULL, NULL, NULL, NULL, NULL, eq.id,
      (CURRENT_DATE - gannet_demo.sem_i(g.k, 2661, 10, 400))::date
    FROM generate_series(1, 70) AS g(k)
    JOIN gannet_demo.equipos eq ON eq.id = 1 + gannet_demo.sem_h(g.k, 2662) % 280
  ) e
) d;

-- =============================================================================
-- 24. SEÑALES DELIBERADAS
-- Hallazgos que el presentador puede señalar en el stand. Se fijan de forma
-- explicita, no se dejan al azar, para que la demo cuente siempre la misma
-- historia. Todas se calculan contra CURRENT_DATE.
-- =============================================================================

-- SEÑAL 1 — Proyecto atrasado: contrato en curso con la fecha de fin planificada
-- vencida hace dos meses y avance fisico por debajo de lo comprometido.
UPDATE gannet_demo.proyectos
SET fecha_fin_plan = (CURRENT_DATE - 62)::date,
    avance_pct     = 58
WHERE id = (
  SELECT id FROM gannet_demo.proyectos
  WHERE estado = 'en_curso'
    AND COALESCE(fecha_inicio_real, fecha_inicio_plan) < CURRENT_DATE - 200
  ORDER BY id LIMIT 1
);

-- SEÑAL 2 — Cliente moroso: Sal de los Andes S.A. ya nace con estado 'moroso' y
-- concentra los comprobantes vencidos. Se refuerza el limite de credito
-- excedido para que el contraste sea visible en la ficha del cliente.
UPDATE gannet_demo.clientes
SET limite_credito_ars = round(
      (SELECT COALESCE(SUM(total_ars), 0) * 0.55
       FROM gannet_demo.facturas
       WHERE cliente_id = gannet_demo.clientes.id AND estado = 'vencida'), 2)
WHERE razon_social = 'Sal de los Andes S.A.';

-- SEÑAL 3 — Stock critico: los articulos cuyo id es multiplo de 13 quedaron por
-- debajo del minimo por construccion. Se refuerza uno con nombre reconocible
-- para que el presentador pueda buscarlo por descripcion.
UPDATE gannet_demo.stock s
SET cantidad = round(a.stock_minimo * 0.04, 2),
    actualizado_en = CURRENT_DATE::timestamptz - INTERVAL '2 days'
FROM gannet_demo.articulos a
WHERE a.id = s.articulo_id
  AND a.descripcion LIKE 'Electrodo revestido E6013%';

-- SEÑAL 4 — Documentacion por vencer: veinticinco documentos vencen dentro de
-- los proximos treinta dias y diez ya estan vencidos.
UPDATE gannet_demo.documentos
SET fecha_vencimiento = (CURRENT_DATE + (id % 30)::int)::date
WHERE id IN (
  SELECT id FROM gannet_demo.documentos
  WHERE tipo IN ('habilitacion','poliza','certificado')
  ORDER BY gannet_demo.sem_h(id, 2701), id LIMIT 25
);

UPDATE gannet_demo.documentos
SET fecha_vencimiento = (CURRENT_DATE - 5 - (id % 40)::int)::date
WHERE id IN (
  SELECT id FROM gannet_demo.documentos
  WHERE tipo IN ('habilitacion','poliza','certificado')
  ORDER BY gannet_demo.sem_h(id, 2702), id LIMIT 10
);

-- SEÑAL 5 — Vehiculo con verificacion tecnica vencida: el vehiculo 17 ya nace
-- con la VTV vencida hace 47 dias. Se lo saca de servicio para que la ficha de
-- flota sea internamente consistente.
UPDATE gannet_demo.vehiculos
SET estado = 'fuera_servicio'
WHERE id = 17;

-- SEÑAL 6 — Instrumental con calibracion vencida: seis instrumentos de medicion
-- quedan con la calibracion caduca y en estado 'en_calibracion'.
UPDATE gannet_demo.equipos
SET proxima_calibracion = (CURRENT_DATE - 12 - (id % 45)::int)::date,
    estado = 'en_calibracion'
WHERE id IN (
  SELECT id FROM gannet_demo.equipos
  WHERE categoria = 'instrumento_medicion'
  ORDER BY gannet_demo.sem_h(id, 2703), id LIMIT 6
);

-- SEÑAL 7 — Actividad de hoy: la bitacora siempre tiene movimiento del dia, de
-- modo que el panel nunca muestre "ultima actividad hace cinco dias".
UPDATE gannet_demo.actividades
SET fecha = CURRENT_DATE::timestamptz + ((id % 9)::int + 8) * INTERVAL '1 hour',
    estado = CASE WHEN id % 3 = 0 THEN 'en_curso' ELSE 'completada' END
WHERE id IN (
  SELECT id FROM gannet_demo.actividades
  ORDER BY gannet_demo.sem_h(id, 2704), id LIMIT 12
);

-- SEÑAL 8 — Orden de trabajo critica en ejecucion hoy: garantiza que el tablero
-- operativo tenga siempre al menos una urgencia visible.
UPDATE gannet_demo.ordenes_trabajo
SET prioridad = 'critica',
    tipo = 'emergencia',
    estado = 'en_ejecucion',
    fecha_programada = CURRENT_DATE,
    fecha_inicio = CURRENT_DATE::timestamptz + INTERVAL '6 hours',
    fecha_fin = NULL
WHERE id = (
  SELECT id FROM gannet_demo.ordenes_trabajo
  WHERE estado = 'en_ejecucion'
  ORDER BY gannet_demo.sem_h(id, 2705), id LIMIT 1
);

-- Reconciliacion posterior a las señales: la señal 8 mueve la fecha de una
-- orden de trabajo, de modo que los partes diarios que la imputaban dejarian de
-- corresponder a ese dia. Se los devuelve a "trabajo en base propia", que es lo
-- unico coherente. Vale para cualquier señal futura que reprograme una orden.
UPDATE gannet_demo.turnos t
SET orden_trabajo_id = NULL,
    faena_id         = NULL
FROM gannet_demo.ordenes_trabajo o
WHERE o.id = t.orden_trabajo_id
  AND o.fecha_programada IS DISTINCT FROM t.fecha;

-- =============================================================================
-- 25. MARCAS DE ALTA (`creado_en`)
-- El DEFAULT de la columna es now(), que cambiaria en cada ejecucion y romperia
-- el determinismo del generador. Se la fija explicitamente, y no a un valor
-- arbitrario sino a la fecha en que el registro habria nacido segun la propia
-- historia del negocio: una orden de trabajo se carga unos dias antes de su
-- fecha programada, una factura el dia que se emite, un empleado el dia que
-- ingresa. Ademas de hacer reproducible la semilla, esto hace que la columna
-- "creado el" que muestra la interfaz sea creible.
-- =============================================================================

UPDATE gannet_demo.empleados
SET creado_en = fecha_ingreso::timestamptz + INTERVAL '8 hours';

UPDATE gannet_demo.clientes
SET creado_en = fecha_alta::timestamptz + INTERVAL '10 hours';

UPDATE gannet_demo.faenas f
SET creado_en = c.creado_en + (gannet_demo.sem_i(f.id, 2801, 1, 90) || ' days')::interval
FROM gannet_demo.clientes c WHERE c.id = f.cliente_id;

UPDATE gannet_demo.contactos ct
SET creado_en = c.creado_en + (gannet_demo.sem_i(ct.id, 2802, 0, 120) || ' days')::interval
FROM gannet_demo.clientes c WHERE c.id = ct.cliente_id;

UPDATE gannet_demo.depositos
SET creado_en = (CURRENT_DATE - 545)::timestamptz + INTERVAL '9 hours';

UPDATE gannet_demo.proveedores
SET creado_en = (CURRENT_DATE - gannet_demo.sem_i(id, 2803, 200, 900))::timestamptz + INTERVAL '11 hours';

UPDATE gannet_demo.vehiculos
SET creado_en = (CURRENT_DATE - gannet_demo.sem_i(id, 2804, 120, 1400))::timestamptz + INTERVAL '9 hours';

UPDATE gannet_demo.equipos
SET creado_en = (CURRENT_DATE - gannet_demo.sem_i(id, 2805, 60, 1200))::timestamptz + INTERVAL '9 hours';

UPDATE gannet_demo.articulos
SET creado_en = (CURRENT_DATE - gannet_demo.sem_i(id, 2806, 90, 1000))::timestamptz + INTERVAL '9 hours';

UPDATE gannet_demo.stock
SET creado_en = actualizado_en - (gannet_demo.sem_i(id, 2807, 30, 400) || ' days')::interval;

-- Un registro nunca puede haberse dado de alta en el futuro. Para lo que aun no
-- ocurrio (proyectos planificados, ordenes programadas, actividades previstas)
-- la marca de alta se acota a un pasado reciente, que es cuando efectivamente se
-- cargaria en el sistema.
UPDATE gannet_demo.proyectos
SET creado_en = LEAST(
      (fecha_inicio_plan - gannet_demo.sem_i(id, 2808, 10, 45))::timestamptz,
      (CURRENT_DATE - gannet_demo.sem_i(id, 2811, 2, 40))::timestamptz) + INTERVAL '10 hours';

UPDATE gannet_demo.ordenes_trabajo
SET creado_en = LEAST(
      (fecha_programada - gannet_demo.sem_i(id, 2809, 1, 15))::timestamptz,
      (CURRENT_DATE - gannet_demo.sem_i(id, 2812, 0, 30))::timestamptz) + INTERVAL '8 hours';

UPDATE gannet_demo.ot_asignaciones a
SET creado_en = o.creado_en + INTERVAL '2 hours'
FROM gannet_demo.ordenes_trabajo o WHERE o.id = a.orden_trabajo_id;

UPDATE gannet_demo.turnos
SET creado_en = fecha::timestamptz + INTERVAL '20 hours';

UPDATE gannet_demo.cotizaciones
SET creado_en = fecha_emision::timestamptz + INTERVAL '9 hours';

UPDATE gannet_demo.cotizacion_items i
SET creado_en = c.creado_en + INTERVAL '1 hour'
FROM gannet_demo.cotizaciones c WHERE c.id = i.cotizacion_id;

UPDATE gannet_demo.facturas
SET creado_en = fecha_emision::timestamptz + INTERVAL '11 hours';

UPDATE gannet_demo.ordenes_compra
SET creado_en = fecha_emision::timestamptz + INTERVAL '9 hours';

UPDATE gannet_demo.orden_compra_items i
SET creado_en = oc.creado_en + INTERVAL '1 hour'
FROM gannet_demo.ordenes_compra oc WHERE oc.id = i.orden_compra_id;

UPDATE gannet_demo.movimientos_stock
SET creado_en = fecha;

UPDATE gannet_demo.mantenimientos
SET creado_en = LEAST(
      (fecha - gannet_demo.sem_i(id, 2810, 1, 20))::timestamptz,
      (CURRENT_DATE - gannet_demo.sem_i(id, 2813, 0, 25))::timestamptz) + INTERVAL '10 hours';

UPDATE gannet_demo.actividades
SET creado_en = LEAST(
      fecha,
      CURRENT_DATE::timestamptz
        - (gannet_demo.sem_i(id, 2814, 0, 20) || ' days')::interval
        + INTERVAL '9 hours');

UPDATE gannet_demo.documentos
SET creado_en = fecha_emision::timestamptz + INTERVAL '12 hours';

-- =============================================================================
-- 25.b CATALOGO DE TEXTOS
-- Titulos y descripciones de orden de trabajo, nombres de proyecto y
-- descripciones de renglon de cotizacion.
--
-- La logica NO vive aca. Vive en gannet_demo.aplicar_catalogo_textos(), que
-- crea la migracion 20260720000001 junto con la tabla gannet_demo.catalogo_textos.
-- Ese es el punto: la migracion y este generador tienen que producir exactamente
-- los mismos textos, y la unica forma de garantizarlo sin confiar en que alguien
-- edite dos copias a la vez es que haya una sola copia.
--
-- Las migraciones corren siempre antes que este generador, tanto en el VPS como
-- en el arranque local desde cero, asi que la funcion existe. Sobrevive a la
-- limpieza del bloque 26, que solo elimina `sem_*` y las tablas `tmp_*`.
-- =============================================================================

DO $$
BEGIN
  IF to_regprocedure('gannet_demo.aplicar_catalogo_textos()') IS NULL THEN
    RAISE EXCEPTION
      'Falta gannet_demo.aplicar_catalogo_textos(). Aplicar las migraciones de supabase/migrations/ antes de correr este generador.';
  END IF;
END $$;

SELECT gannet_demo.aplicar_catalogo_textos();

-- Ningun texto provisional puede sobrevivir. Si la funcion no cubrio alguna
-- fila, es preferible abortar la siembra que servir "(pendiente de catalogo)"
-- en la grilla que se proyecta en el congreso.
DO $$
DECLARE
  n bigint;
BEGIN
  SELECT (SELECT COUNT(*) FROM gannet_demo.ordenes_trabajo
            WHERE titulo LIKE '(pendiente de catalogo)%'
               OR descripcion LIKE '(pendiente de catalogo)%')
       + (SELECT COUNT(*) FROM gannet_demo.proyectos
            WHERE nombre LIKE '(pendiente de catalogo)%')
       + (SELECT COUNT(*) FROM gannet_demo.cotizacion_items
            WHERE descripcion LIKE '(pendiente de catalogo)%')
  INTO n;

  IF n > 0 THEN
    RAISE EXCEPTION '% filas quedaron con texto provisional del catalogo.', n;
  END IF;
END $$;

-- =============================================================================
-- 25.c MODELO DE FACTURACION MENSUAL
-- Da forma a la curva de "Evolucion de facturacion", que es el primer grafico
-- del panel ejecutivo y la pantalla con la que abre la demo.
--
-- Igual que 25.b, la logica NO vive aca: vive en
-- gannet_demo.aplicar_modelo_facturacion(), que crea la migracion
-- 20260720000002 junto con gannet_demo.modelo_facturacion y su perfil
-- estacional. Una sola copia, para que el VPS y el arranque local desde cero
-- produzcan exactamente la misma curva.
--
-- Corre DESPUES de 25.a, que fija `creado_en` a partir de la fecha de emision:
-- la funcion mueve fechas de emision, asi que reescribe tambien el `creado_en`
-- de los comprobantes que toca.
-- =============================================================================

DO $$
BEGIN
  IF to_regprocedure('gannet_demo.aplicar_modelo_facturacion()') IS NULL THEN
    RAISE EXCEPTION
      'Falta gannet_demo.aplicar_modelo_facturacion(). Aplicar las migraciones de supabase/migrations/ antes de correr este generador.';
  END IF;
END $$;

SELECT gannet_demo.aplicar_modelo_facturacion();

-- La curva es lo primero que se proyecta en el congreso. Si quedo rota es
-- preferible abortar la siembra que descubrirlo en el escenario.
DO $$
DECLARE
  v_ratio numeric;
  v_peor  numeric;
  v_min   numeric;
BEGIN
  SELECT MIN(emitido_ars),
         MAX(emitido_ars) / NULLIF(MIN(emitido_ars), 0)
    INTO v_min, v_ratio
  FROM public.gd_facturacion_mensual WHERE NOT es_mes_parcial;

  IF v_min < 1000000000 THEN
    RAISE EXCEPTION 'La ventana del grafico arranca con un mes de solo %.', v_min;
  END IF;

  IF v_ratio > 3 THEN
    RAISE EXCEPTION 'La serie tiene un maximo sobre minimo de % a 1.', round(v_ratio, 1);
  END IF;

  SELECT MAX(ABS(v)) INTO v_peor FROM (
    SELECT emitido_ars / NULLIF(LAG(emitido_ars) OVER (ORDER BY mes), 0) - 1 AS v
    FROM public.gd_facturacion_mensual WHERE NOT es_mes_parcial
  ) d;

  IF v_peor > 0.34 THEN
    RAISE EXCEPTION 'La serie tiene una variacion mensual de % por ciento.', round(v_peor * 100, 1);
  END IF;
END $$;

-- =============================================================================
-- 26. CIERRE
-- Se reposicionan las secuencias de identidad, que quedaron en 1 porque las
-- claves se insertaron explicitamente, y se eliminan los auxiliares del
-- generador para no dejar residuos en el esquema.
-- =============================================================================

DO $$
DECLARE
  t text;
  seq text;
  maximo bigint;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'gannet_demo' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    -- No toda tabla del esquema tiene columna `id`: el catalogo de textos usa
    -- clave compuesta. `pg_get_serial_sequence` NO devuelve NULL en ese caso,
    -- lanza "column does not exist", asi que la existencia de la columna se
    -- comprueba antes de preguntar por la secuencia.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'gannet_demo' AND table_name = t AND column_name = 'id');

    seq := pg_get_serial_sequence('gannet_demo.' || quote_ident(t), 'id');
    IF seq IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(max(id), 0) FROM gannet_demo.%I', t) INTO maximo;
      PERFORM setval(seq, GREATEST(maximo, 1), maximo > 0);
    END IF;
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS gannet_demo.sem_n(bigint, bigint, numeric, numeric, integer);
DROP FUNCTION IF EXISTS gannet_demo.sem_i(bigint, bigint, integer, integer);
DROP FUNCTION IF EXISTS gannet_demo.sem_r(bigint, bigint);
DROP FUNCTION IF EXISTS gannet_demo.sem_h(bigint, bigint);

DROP TABLE IF EXISTS tmp_srv;
DROP TABLE IF EXISTS tmp_calendario;
DROP TABLE IF EXISTS tmp_peso_cliente;
DROP TABLE IF EXISTS tmp_peso_servicio;
DROP TABLE IF EXISTS tmp_peso_proyecto;
DROP TABLE IF EXISTS tmp_peso_proy_fact;
DROP TABLE IF EXISTS tmp_ot_facturable;
DROP TABLE IF EXISTS tmp_faena;
DROP TABLE IF EXISTS tmp_contacto;
DROP TABLE IF EXISTS tmp_eq_cat;
DROP TABLE IF EXISTS tmp_eq_nom;
DROP TABLE IF EXISTS tmp_art;

COMMIT;

-- =============================================================================
-- FIN DE LA SEMILLA
-- =============================================================================
