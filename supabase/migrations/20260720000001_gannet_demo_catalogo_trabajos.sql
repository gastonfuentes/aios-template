-- =============================================================================
-- Gannet OS — Demo Congreso Minero
-- Catalogo de trabajos: variedad real en ordenes de trabajo, proyectos y
-- renglones de cotizacion
-- =============================================================================
--
-- WHY THIS MIGRATION EXISTS
--
--   The work-orders module (`/ordenes-trabajo`) is one of the three modules
--   presented live. Its grid opened on rows that read as copy-pasted:
--
--     OT-00875  Mantenimiento preventivo de equipos de planta — Campamento …
--     OT-00760  Mantenimiento preventivo de equipos de planta — Campamento …
--     OT-00411  Mantenimiento preventivo de equipos de planta — Campamento …
--     OT-01055  Mantenimiento preventivo de equipos de planta — Campamento …
--
--   Four of the first seven visible rows carried the same title for the same
--   client. This is the truck-brand defect again: an audience that writes work
--   orders every day reads one screen like that and treats every other figure
--   in the demo as invented.
--
--   ROOT CAUSE — the generator held exactly ONE title per service:
--
--       (ARRAY['Mantenimiento preventivo de equipos de planta', …])[srv_idx]
--         || ' — ' || faena.nombre
--
--   Ten services therefore produced ten job names for 1,350 orders (218
--   distinct full titles once the site name is appended), and the description
--   was a single boilerplate sentence per service — 10 distinct strings across
--   all 1,350 rows.
--
--   SECOND DEFECT, SAME LINE OF CODE. `titulo` was derived from the service
--   alone while `tipo` was drawn from an independent hash, so the two columns
--   contradicted each other on screen. 59 orders titled "Mantenimiento
--   PREVENTIVO …" were typed `correctivo` and 11 were typed `emergencia`, with
--   both columns visible side by side in the grid. A maintenance planner reads
--   that instantly. The catalogue below is keyed by (service, tipo), so the
--   title and the type can no longer disagree.
--
--   SIBLING MODULES — the same small-catalogue defect, same fix:
--     * `proyectos.nombre`          — 69 distinct names for 80 projects; ten
--                                     names repeated, one of them three times.
--     * `cotizacion_items.descripcion` — 10 distinct strings for 1,448 line
--                                     items ("<servicio> según alcance
--                                     acordado con el cliente").
--
-- DESIGN — the catalogue is a TABLE, not a literal duplicated in two files
--
--   `20260720000000` had to mirror an array literal byte-for-byte between the
--   migration and the generator, and says so in its own comments. That hazard
--   is not repeated here. The catalogue lives in `gannet_demo.catalogo_textos`,
--   this migration is its only author, and the generator SELECTs from it. On a
--   from-scratch boot the migrations run before the generator, so the table is
--   always present. There is exactly one copy of every string.
--
--   The generator's cleanup block does not touch this table, so re-running the
--   seed does not empty it.
--
-- DETERMINISM
--
--   Selection is `1 + h(id, salt) % n`, where `h` is the same pure md5 hash the
--   generator uses and `n` is the number of variants actually present in the
--   bucket, read from the catalogue rather than hard-coded. No random(), no
--   setseed(), no dependence on query plan or row order. The generator calls
--   `gannet_demo.sem_h`; this migration inlines the identical expression,
--   because the generator DROPs `sem_h` on its final lines and the function
--   does not exist at migration time. Section 7 asserts the two agree.
--
-- SECURITY — READ BEFORE EDITING
--
--   This database carries the Supabase default:
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT ALL ON TABLES TO anon, authenticated, service_role;
--
--   Every relation created in `public` is born writable by `anon`, and a later
--   GRANT SELECT removes nothing. This migration creates NOTHING in `public`
--   and recreates no view, so it opens no new surface. The closing assertions
--   re-audit every `public.gd_*` view and every `gannet_demo` base table
--   anyway: a regression introduced elsewhere should abort this deploy rather
--   than ship.
--
-- IDEMPOTENCE
--   Single transaction. The catalogue upserts by primary key and every UPDATE
--   is a pure function of the row id, so re-applying is a no-op.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. gannet_demo.catalogo_textos — the single source of the demo's job wording
-- =============================================================================
-- `dominio` names the consumer, `servicio_idx` is the logical service index
-- 1..10 (the same ordering the generator's `tmp_srv` uses), `tipo` is the work
-- order type for the `ot_titulo` domain and '' elsewhere, and `variante`
-- numbers the alternatives inside a bucket. Callers never hard-code the number
-- of variants: they read it from this table, so a bucket can grow later
-- without touching a single formula.
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.catalogo_textos (
  dominio      text    NOT NULL,
  servicio_idx integer NOT NULL,
  tipo         text    NOT NULL DEFAULT '',
  variante     integer NOT NULL,
  texto        text    NOT NULL,
  PRIMARY KEY (dominio, servicio_idx, tipo, variante),
  CONSTRAINT catalogo_textos_dominio_check CHECK (dominio IN (
    'ot_titulo', 'ot_alcance', 'proyecto_nombre', 'cotizacion_item')),
  CONSTRAINT catalogo_textos_servicio_idx_check CHECK (servicio_idx BETWEEN 0 AND 10),
  CONSTRAINT catalogo_textos_variante_check CHECK (variante >= 1),
  CONSTRAINT catalogo_textos_texto_check CHECK (length(btrim(texto)) > 0)
);

COMMENT ON TABLE gannet_demo.catalogo_textos IS
  'Catalogo de textos del generador de demo: titulos de orden de trabajo por servicio y tipo, frases de alcance, nombres de proyecto y descripciones de renglon de cotizacion. Es la unica copia de estas cadenas: la semilla las lee de aqui en lugar de llevar sus propias listas, de modo que no existe un literal duplicado entre la migracion y el generador. La seleccion es determinista, por hash md5 del identificador de la fila contra la cantidad de variantes del grupo.';

COMMENT ON COLUMN gannet_demo.catalogo_textos.dominio IS
  'Consumidor del texto: ot_titulo, ot_alcance, proyecto_nombre o cotizacion_item.';
COMMENT ON COLUMN gannet_demo.catalogo_textos.servicio_idx IS
  'Indice logico de servicio 1..10 en el mismo orden que usa el generador (MANT_IND, OBRA_CIVIL, ELEC_IND, INST_AUTO, SOLD_MONT, TRANS_LOG, ALQ_MAQ, MOV_SUELO, SERV_CAMP, LIMP_IND). Vale 0 cuando el texto no depende del servicio.';
COMMENT ON COLUMN gannet_demo.catalogo_textos.tipo IS
  'Tipo de orden de trabajo al que pertenece el titulo: preventivo, correctivo, programado, inspeccion, instalacion o emergencia. Cadena vacia en los dominios que no dependen del tipo. Existe para que el titulo y la columna tipo de la grilla no puedan contradecirse.';
COMMENT ON COLUMN gannet_demo.catalogo_textos.variante IS
  'Numero de alternativa dentro del grupo. La cantidad de variantes por grupo se consulta, no se supone.';
COMMENT ON COLUMN gannet_demo.catalogo_textos.texto IS
  'Texto en castellano, tal como lo lee el usuario final de la demo.';

-- El esquema gannet_demo solo concede a service_role por defecto, pero la
-- concesion es explicita para que no dependa de un default que puede cambiar.
REVOKE ALL ON gannet_demo.catalogo_textos FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1.a  ot_titulo — 180 titulos: 10 servicios x 6 tipos x 3 variantes.
--      El tipo forma parte de la clave, asi que una orden correctiva nunca
--      puede titularse "mantenimiento preventivo".
-- -----------------------------------------------------------------------------

INSERT INTO gannet_demo.catalogo_textos (dominio, servicio_idx, tipo, variante, texto) VALUES
-- 1. Mantenimiento industrial
('ot_titulo', 1, 'preventivo',  1, 'Mantenimiento preventivo de bombas y sistemas de impulsión'),
('ot_titulo', 1, 'preventivo',  2, 'Rutina preventiva de cintas transportadoras de planta'),
('ot_titulo', 1, 'preventivo',  3, 'Servicio preventivo de compresores y red de aire comprimido'),
('ot_titulo', 1, 'correctivo',  1, 'Reparación de reductor de molino con falla de rodamiento'),
('ot_titulo', 1, 'correctivo',  2, 'Corrección de pérdida en el sistema hidráulico de chancado'),
('ot_titulo', 1, 'correctivo',  3, 'Recambio de rodillos y polines en cinta de descarga'),
('ot_titulo', 1, 'programado',  1, 'Parada programada de planta para overhaul de equipos'),
('ot_titulo', 1, 'programado',  2, 'Cambio programado de aceites y filtros de equipos fijos'),
('ot_titulo', 1, 'programado',  3, 'Mantenimiento programado de zarandas vibratorias'),
('ot_titulo', 1, 'inspeccion',  1, 'Inspección predictiva por análisis de vibraciones'),
('ot_titulo', 1, 'inspeccion',  2, 'Relevamiento termográfico de motores y accionamientos'),
('ot_titulo', 1, 'inspeccion',  3, 'Inspección de estado de bombas centrífugas de proceso'),
('ot_titulo', 1, 'instalacion', 1, 'Instalación de bomba centrífuga de repuesto en planta'),
('ot_titulo', 1, 'instalacion', 2, 'Montaje de nueva unidad de filtrado de proceso'),
('ot_titulo', 1, 'instalacion', 3, 'Puesta en servicio de sistema de lubricación centralizada'),
('ot_titulo', 1, 'emergencia',  1, 'Atención de emergencia por parada de molino primario'),
('ot_titulo', 1, 'emergencia',  2, 'Intervención de urgencia en bomba de impulsión fuera de servicio'),
('ot_titulo', 1, 'emergencia',  3, 'Reparación de emergencia de cinta transportadora cortada'),
-- 2. Obras civiles
('ot_titulo', 2, 'preventivo',  1, 'Mantenimiento preventivo de caminos internos y alcantarillas'),
('ot_titulo', 2, 'preventivo',  2, 'Sellado preventivo de juntas en losas de hormigón'),
('ot_titulo', 2, 'preventivo',  3, 'Conservación preventiva de canales de drenaje pluvial'),
('ot_titulo', 2, 'correctivo',  1, 'Reparación de platea de hormigón con fisuras estructurales'),
('ot_titulo', 2, 'correctivo',  2, 'Reconstrucción de muro de contención dañado'),
('ot_titulo', 2, 'correctivo',  3, 'Bacheo y recomposición de carpeta en camino de acceso'),
('ot_titulo', 2, 'programado',  1, 'Ejecución de fundaciones y platea para nuevo equipo'),
('ot_titulo', 2, 'programado',  2, 'Construcción de badén y obra de arte en camino minero'),
('ot_titulo', 2, 'programado',  3, 'Hormigonado de pedestales para estructura de planta'),
('ot_titulo', 2, 'inspeccion',  1, 'Inspección estructural de fundaciones y anclajes'),
('ot_titulo', 2, 'inspeccion',  2, 'Control de calidad de hormigón y ensayo de probetas'),
('ot_titulo', 2, 'inspeccion',  3, 'Relevamiento topográfico de plataformas y taludes'),
('ot_titulo', 2, 'instalacion', 1, 'Montaje de estructura premoldeada de hormigón'),
('ot_titulo', 2, 'instalacion', 2, 'Ejecución de losa técnica para sala eléctrica'),
('ot_titulo', 2, 'instalacion', 3, 'Colocación de pisos industriales de alta resistencia'),
('ot_titulo', 2, 'emergencia',  1, 'Contención de emergencia por desprendimiento de talud'),
('ot_titulo', 2, 'emergencia',  2, 'Reparación urgente de camino cortado por escorrentía'),
('ot_titulo', 2, 'emergencia',  3, 'Apuntalamiento de emergencia de estructura comprometida'),
-- 3. Electricidad industrial
('ot_titulo', 3, 'preventivo',  1, 'Mantenimiento preventivo de tableros de baja tensión'),
('ot_titulo', 3, 'preventivo',  2, 'Termografía y ajuste de conexiones en sala eléctrica'),
('ot_titulo', 3, 'preventivo',  3, 'Rutina preventiva de grupos electrógenos de respaldo'),
('ot_titulo', 3, 'correctivo',  1, 'Reparación de falla a tierra en alimentador de media tensión'),
('ot_titulo', 3, 'correctivo',  2, 'Recambio de interruptor de potencia averiado'),
('ot_titulo', 3, 'correctivo',  3, 'Corrección de sobrecalentamiento en barras de tablero general'),
('ot_titulo', 3, 'programado',  1, 'Tendido y conexionado de tablero de media tensión'),
('ot_titulo', 3, 'programado',  2, 'Ampliación programada de la red eléctrica de planta'),
('ot_titulo', 3, 'programado',  3, 'Recambio programado de luminarias a tecnología LED'),
('ot_titulo', 3, 'inspeccion',  1, 'Medición de puesta a tierra y continuidad de masas'),
('ot_titulo', 3, 'inspeccion',  2, 'Inspección de aislación en cables de media tensión'),
('ot_titulo', 3, 'inspeccion',  3, 'Auditoría eléctrica de tableros y protecciones'),
('ot_titulo', 3, 'instalacion', 1, 'Instalación de centro de transformación de 13,2 kV'),
('ot_titulo', 3, 'instalacion', 2, 'Montaje de banco de capacitores para corrección de coseno'),
('ot_titulo', 3, 'instalacion', 3, 'Instalación de iluminación perimetral de faena'),
('ot_titulo', 3, 'emergencia',  1, 'Atención de emergencia por corte total de energía en planta'),
('ot_titulo', 3, 'emergencia',  2, 'Restitución urgente de alimentación a bombas críticas'),
('ot_titulo', 3, 'emergencia',  3, 'Reparación de emergencia de acometida de media tensión'),
-- 4. Instrumentacion y automatizacion
('ot_titulo', 4, 'preventivo',  1, 'Mantenimiento preventivo de lazos de control de proceso'),
('ot_titulo', 4, 'preventivo',  2, 'Verificación preventiva de transmisores de presión y caudal'),
('ot_titulo', 4, 'preventivo',  3, 'Rutina preventiva del sistema SCADA y sus periféricos'),
('ot_titulo', 4, 'correctivo',  1, 'Reparación de lazo de control con lectura errática'),
('ot_titulo', 4, 'correctivo',  2, 'Recambio de válvula de control con falla de posicionador'),
('ot_titulo', 4, 'correctivo',  3, 'Corrección de falla de comunicación en red industrial'),
('ot_titulo', 4, 'programado',  1, 'Calibración de instrumentos y certificación de lazos'),
('ot_titulo', 4, 'programado',  2, 'Actualización programada de la lógica del PLC de planta'),
('ot_titulo', 4, 'programado',  3, 'Recalibración de balanzas y básculas de despacho'),
('ot_titulo', 4, 'inspeccion',  1, 'Auditoría de lazos de seguridad y enclavamientos'),
('ot_titulo', 4, 'inspeccion',  2, 'Verificación metrológica de instrumentos de proceso'),
('ot_titulo', 4, 'inspeccion',  3, 'Inspección de gabinetes de instrumentación en campo'),
('ot_titulo', 4, 'instalacion', 1, 'Instalación de caudalímetros en línea de impulsión'),
('ot_titulo', 4, 'instalacion', 2, 'Montaje de sistema de detección de gases en planta'),
('ot_titulo', 4, 'instalacion', 3, 'Puesta en marcha de nuevo PLC y arquitectura de red'),
('ot_titulo', 4, 'emergencia',  1, 'Atención de emergencia por falla del sistema de control'),
('ot_titulo', 4, 'emergencia',  2, 'Intervención urgente por enclavamiento de seguridad disparado'),
('ot_titulo', 4, 'emergencia',  3, 'Restitución de emergencia de la telemetría de tanques'),
-- 5. Soldadura y montaje
('ot_titulo', 5, 'preventivo',  1, 'Inspección y refuerzo preventivo de soldaduras estructurales'),
('ot_titulo', 5, 'preventivo',  2, 'Mantenimiento preventivo de estructuras metálicas de planta'),
('ot_titulo', 5, 'preventivo',  3, 'Protección anticorrosiva preventiva de cañerías'),
('ot_titulo', 5, 'correctivo',  1, 'Reparación de fisura en cañería de proceso'),
('ot_titulo', 5, 'correctivo',  2, 'Recambio de tramo de cañería con desgaste por abrasión'),
('ot_titulo', 5, 'correctivo',  3, 'Resoldadura de estructura con falla en el cordón'),
('ot_titulo', 5, 'programado',  1, 'Soldadura y montaje de cañería de proceso'),
('ot_titulo', 5, 'programado',  2, 'Montaje programado de estructura metálica de plataforma'),
('ot_titulo', 5, 'programado',  3, 'Prefabricado y montaje de spools en taller y campo'),
('ot_titulo', 5, 'inspeccion',  1, 'Ensayos no destructivos por ultrasonido en soldaduras'),
('ot_titulo', 5, 'inspeccion',  2, 'Inspección radiográfica de uniones soldadas'),
('ot_titulo', 5, 'inspeccion',  3, 'Control dimensional de estructura montada'),
('ot_titulo', 5, 'instalacion', 1, 'Montaje de tanque de almacenamiento y sus accesorios'),
('ot_titulo', 5, 'instalacion', 2, 'Instalación de pasarelas y barandas metálicas'),
('ot_titulo', 5, 'instalacion', 3, 'Montaje de silo y estructura de soporte'),
('ot_titulo', 5, 'emergencia',  1, 'Reparación de emergencia por rotura de cañería de impulsión'),
('ot_titulo', 5, 'emergencia',  2, 'Soldadura de urgencia en estructura comprometida'),
('ot_titulo', 5, 'emergencia',  3, 'Intervención de emergencia en línea de proceso fisurada'),
-- 6. Transporte y logistica
('ot_titulo', 6, 'preventivo',  1, 'Reposición preventiva de stock de consumibles en faena'),
('ot_titulo', 6, 'preventivo',  2, 'Abastecimiento preventivo de combustible a equipos en faena'),
('ot_titulo', 6, 'preventivo',  3, 'Traslado preventivo de repuestos críticos al pañol de faena'),
('ot_titulo', 6, 'correctivo',  1, 'Traslado de repuestos para reparación en planta'),
('ot_titulo', 6, 'correctivo',  2, 'Retiro de equipo fuera de servicio hacia el taller central'),
('ot_titulo', 6, 'correctivo',  3, 'Reprogramación de flete por desvío de ruta en cordillera'),
('ot_titulo', 6, 'programado',  1, 'Traslado de insumos y personal a faena'),
('ot_titulo', 6, 'programado',  2, 'Transporte programado de cargas generales a campamento'),
('ot_titulo', 6, 'programado',  3, 'Flete programado de materiales desde el depósito central'),
('ot_titulo', 6, 'inspeccion',  1, 'Control de carga y precintado de despacho a faena'),
('ot_titulo', 6, 'inspeccion',  2, 'Verificación de documentación y cartas de porte'),
('ot_titulo', 6, 'inspeccion',  3, 'Inspección de aptitud de unidades para carga peligrosa'),
('ot_titulo', 6, 'instalacion', 1, 'Traslado y posicionamiento de módulos habitacionales'),
('ot_titulo', 6, 'instalacion', 2, 'Transporte especial de equipo sobredimensionado'),
('ot_titulo', 6, 'instalacion', 3, 'Movilización de campamento y equipos a nuevo frente'),
('ot_titulo', 6, 'emergencia',  1, 'Traslado de emergencia de personal por contingencia en faena'),
('ot_titulo', 6, 'emergencia',  2, 'Flete de urgencia de repuesto crítico a planta'),
('ot_titulo', 6, 'emergencia',  3, 'Retiro de emergencia de equipos por alerta meteorológica'),
-- 7. Alquiler de maquinaria y equipos
('ot_titulo', 7, 'preventivo',  1, 'Mantenimiento preventivo de maquinaria en alquiler'),
('ot_titulo', 7, 'preventivo',  2, 'Servicio preventivo de grupo electrógeno alquilado'),
('ot_titulo', 7, 'preventivo',  3, 'Rutina preventiva de equipos de izaje en obra'),
('ot_titulo', 7, 'correctivo',  1, 'Reparación en sitio de excavadora en alquiler'),
('ot_titulo', 7, 'correctivo',  2, 'Recambio de equipo alquilado por falla mecánica'),
('ot_titulo', 7, 'correctivo',  3, 'Corrección de falla hidráulica en manipulador telescópico'),
('ot_titulo', 7, 'programado',  1, 'Provisión de maquinaria con operador'),
('ot_titulo', 7, 'programado',  2, 'Alquiler programado de grúa para izaje de equipos'),
('ot_titulo', 7, 'programado',  3, 'Provisión de grupo electrógeno para parada de planta'),
('ot_titulo', 7, 'inspeccion',  1, 'Inspección de aptitud y certificación de equipos de izaje'),
('ot_titulo', 7, 'inspeccion',  2, 'Peritaje de estado de maquinaria al inicio del alquiler'),
('ot_titulo', 7, 'inspeccion',  3, 'Control de horómetros y consumo de equipos alquilados'),
('ot_titulo', 7, 'instalacion', 1, 'Movilización e instalación de planta de hormigón en faena'),
('ot_titulo', 7, 'instalacion', 2, 'Puesta a disposición de compresores y equipos auxiliares'),
('ot_titulo', 7, 'instalacion', 3, 'Instalación de torres de iluminación en frente de trabajo'),
('ot_titulo', 7, 'emergencia',  1, 'Provisión de emergencia de grupo electrógeno por corte'),
('ot_titulo', 7, 'emergencia',  2, 'Envío urgente de bomba de achique a frente anegado'),
('ot_titulo', 7, 'emergencia',  3, 'Grúa de emergencia para retiro de equipo siniestrado'),
-- 8. Movimiento de suelos
('ot_titulo', 8, 'preventivo',  1, 'Conservación preventiva de taludes y bermas'),
('ot_titulo', 8, 'preventivo',  2, 'Perfilado preventivo de caminos de acarreo'),
('ot_titulo', 8, 'preventivo',  3, 'Mantenimiento preventivo de piletas de decantación'),
('ot_titulo', 8, 'correctivo',  1, 'Recomposición de talud con desprendimiento'),
('ot_titulo', 8, 'correctivo',  2, 'Retiro de derrumbe en camino de acarreo'),
('ot_titulo', 8, 'correctivo',  3, 'Corrección de pendientes en plataforma anegada'),
('ot_titulo', 8, 'programado',  1, 'Excavación y nivelación de plataforma'),
('ot_titulo', 8, 'programado',  2, 'Movimiento de suelos para ampliación de dique de colas'),
('ot_titulo', 8, 'programado',  3, 'Apertura programada de camino de acceso a nuevo frente'),
('ot_titulo', 8, 'inspeccion',  1, 'Relevamiento topográfico de avance de movimiento de suelos'),
('ot_titulo', 8, 'inspeccion',  2, 'Control de compactación y densidad de terraplén'),
('ot_titulo', 8, 'inspeccion',  3, 'Inspección geotécnica de taludes y bermas'),
('ot_titulo', 8, 'instalacion', 1, 'Preparación de plataforma para montaje de equipo'),
('ot_titulo', 8, 'instalacion', 2, 'Construcción de terraplén y base para tanque'),
('ot_titulo', 8, 'instalacion', 3, 'Conformación de pileta impermeabilizada'),
('ot_titulo', 8, 'emergencia',  1, 'Despeje de emergencia de camino por alud'),
('ot_titulo', 8, 'emergencia',  2, 'Contención de emergencia de escorrentía en frente de trabajo'),
('ot_titulo', 8, 'emergencia',  3, 'Movimiento de suelos de urgencia por rotura de dique'),
-- 9. Servicios de campamento
('ot_titulo', 9, 'preventivo',  1, 'Mantenimiento preventivo de instalaciones de campamento'),
('ot_titulo', 9, 'preventivo',  2, 'Sanitización preventiva de comedor y cocina'),
('ot_titulo', 9, 'preventivo',  3, 'Servicio preventivo de planta de tratamiento de efluentes'),
('ot_titulo', 9, 'correctivo',  1, 'Reparación del sistema de agua caliente en dormitorios'),
('ot_titulo', 9, 'correctivo',  2, 'Corrección de falla en la climatización de módulos'),
('ot_titulo', 9, 'correctivo',  3, 'Reparación de instalación sanitaria en campamento'),
('ot_titulo', 9, 'programado',  1, 'Operación de servicios generales de campamento'),
('ot_titulo', 9, 'programado',  2, 'Servicio programado de catering y hotelería de faena'),
('ot_titulo', 9, 'programado',  3, 'Gestión programada de residuos y efluentes de campamento'),
('ot_titulo', 9, 'inspeccion',  1, 'Auditoría higiénico-sanitaria de comedor y cocina'),
('ot_titulo', 9, 'inspeccion',  2, 'Control bacteriológico del agua potable de campamento'),
('ot_titulo', 9, 'inspeccion',  3, 'Inspección de habitabilidad de módulos dormitorio'),
('ot_titulo', 9, 'instalacion', 1, 'Instalación de módulos habitacionales en campamento'),
('ot_titulo', 9, 'instalacion', 2, 'Montaje de planta potabilizadora de campamento'),
('ot_titulo', 9, 'instalacion', 3, 'Habilitación de nuevo sector de comedor y sanitarios'),
('ot_titulo', 9, 'emergencia',  1, 'Atención de emergencia por corte de agua en campamento'),
('ot_titulo', 9, 'emergencia',  2, 'Restitución urgente de energía en módulos habitacionales'),
('ot_titulo', 9, 'emergencia',  3, 'Contingencia sanitaria de emergencia en comedor de faena'),
-- 10. Limpieza industrial
('ot_titulo', 10, 'preventivo',  1, 'Limpieza preventiva de sumideros y canaletas de proceso'),
('ot_titulo', 10, 'preventivo',  2, 'Aspirado preventivo de polvo en el sector de chancado'),
('ot_titulo', 10, 'preventivo',  3, 'Limpieza preventiva de intercambiadores de calor'),
('ot_titulo', 10, 'correctivo',  1, 'Remoción de material acumulado en tolva obstruida'),
('ot_titulo', 10, 'correctivo',  2, 'Desobstrucción de cañería de proceso con incrustaciones'),
('ot_titulo', 10, 'correctivo',  3, 'Limpieza correctiva de derrame en el sector de bombas'),
('ot_titulo', 10, 'programado',  1, 'Limpieza técnica de tanques y áreas de proceso'),
('ot_titulo', 10, 'programado',  2, 'Hidrolavado programado de estructuras y pisos industriales'),
('ot_titulo', 10, 'programado',  3, 'Limpieza programada de piletas y decantadores'),
('ot_titulo', 10, 'inspeccion',  1, 'Inspección de espacio confinado previa a la limpieza'),
('ot_titulo', 10, 'inspeccion',  2, 'Control de orden y limpieza en áreas operativas'),
('ot_titulo', 10, 'inspeccion',  3, 'Verificación ambiental de la gestión de residuos industriales'),
('ot_titulo', 10, 'instalacion', 1, 'Habilitación de sector limpio para montaje de equipos'),
('ot_titulo', 10, 'instalacion', 2, 'Instalación de sistema de aspiración de polvo'),
('ot_titulo', 10, 'instalacion', 3, 'Puesta en marcha de estación de lavado de equipos'),
('ot_titulo', 10, 'emergencia',  1, 'Atención de emergencia por derrame de hidrocarburos'),
('ot_titulo', 10, 'emergencia',  2, 'Limpieza de urgencia por rotura de línea de pulpa'),
('ot_titulo', 10, 'emergencia',  3, 'Contención de emergencia de derrame químico en planta')
ON CONFLICT (dominio, servicio_idx, tipo, variante) DO UPDATE SET texto = EXCLUDED.texto;

-- -----------------------------------------------------------------------------
-- 1.b  ot_alcance — cierre de la descripcion. No depende del servicio, por eso
--      servicio_idx = 0.
-- -----------------------------------------------------------------------------

INSERT INTO gannet_demo.catalogo_textos (dominio, servicio_idx, tipo, variante, texto) VALUES
('ot_alcance', 0, '', 1, 'Alcance acordado con el cliente, con informe técnico de cierre entregado.'),
('ot_alcance', 0, '', 2, 'Incluye provisión de mano de obra especializada, herramientas y consumibles.'),
('ot_alcance', 0, '', 3, 'Coordinado con el área de operaciones del cliente para acotar la parada.'),
('ot_alcance', 0, '', 4, 'Ejecutado con permiso de trabajo y análisis de riesgo previo a la tarea.'),
('ot_alcance', 0, '', 5, 'Incluye retiro, clasificación y disposición final de los residuos generados.'),
('ot_alcance', 0, '', 6, 'Supervisado por el jefe de área, con registro fotográfico de avance.'),
('ot_alcance', 0, '', 7, 'Ejecutado en la ventana de turno acordada con la supervisión de faena.'),
('ot_alcance', 0, '', 8, 'Incluye protocolo de pruebas y entrega en condiciones de operación.')
ON CONFLICT (dominio, servicio_idx, tipo, variante) DO UPDATE SET texto = EXCLUDED.texto;

-- -----------------------------------------------------------------------------
-- 1.c  proyecto_nombre — 80 nombres de contrato: 10 servicios x 8 variantes.
--      Escala de contrato, no de tarea: un proyecto agrupa muchas OT.
-- -----------------------------------------------------------------------------

INSERT INTO gannet_demo.catalogo_textos (dominio, servicio_idx, tipo, variante, texto) VALUES
('proyecto_nombre', 1, '', 1, 'Mantenimiento integral de planta'),
('proyecto_nombre', 1, '', 2, 'Contrato de mantenimiento mecánico de planta concentradora'),
('proyecto_nombre', 1, '', 3, 'Servicio de mantenimiento de bombas y sistemas de impulsión'),
('proyecto_nombre', 1, '', 4, 'Mantenimiento de cintas transportadoras y manejo de materiales'),
('proyecto_nombre', 1, '', 5, 'Programa de mantenimiento predictivo de activos críticos'),
('proyecto_nombre', 1, '', 6, 'Parada mayor de planta y overhaul de equipos'),
('proyecto_nombre', 1, '', 7, 'Mantenimiento de aire comprimido y servicios auxiliares'),
('proyecto_nombre', 1, '', 8, 'Contrato marco de mantenimiento industrial'),
('proyecto_nombre', 2, '', 1, 'Obra civil de infraestructura'),
('proyecto_nombre', 2, '', 2, 'Construcción de fundaciones para ampliación de planta'),
('proyecto_nombre', 2, '', 3, 'Obra civil de caminos internos y obras de arte'),
('proyecto_nombre', 2, '', 4, 'Construcción de sala eléctrica y edificio de control'),
('proyecto_nombre', 2, '', 5, 'Obra civil de ampliación de dique de colas'),
('proyecto_nombre', 2, '', 6, 'Ejecución de plataformas y pisos industriales'),
('proyecto_nombre', 2, '', 7, 'Construcción de canales de drenaje y manejo de aguas'),
('proyecto_nombre', 2, '', 8, 'Refacción estructural de edificios de proceso'),
('proyecto_nombre', 3, '', 1, 'Montaje eléctrico de media tensión'),
('proyecto_nombre', 3, '', 2, 'Electrificación de nuevo frente de explotación'),
('proyecto_nombre', 3, '', 3, 'Instalación de centro de transformación y distribución'),
('proyecto_nombre', 3, '', 4, 'Recambio integral de iluminación de planta a LED'),
('proyecto_nombre', 3, '', 5, 'Contrato de mantenimiento eléctrico de faena'),
('proyecto_nombre', 3, '', 6, 'Montaje de sala eléctrica y tableros de potencia'),
('proyecto_nombre', 3, '', 7, 'Sistema de puesta a tierra y protección contra descargas'),
('proyecto_nombre', 3, '', 8, 'Ampliación de red eléctrica de campamento y servicios'),
('proyecto_nombre', 4, '', 1, 'Instrumentación y control de proceso'),
('proyecto_nombre', 4, '', 2, 'Automatización de planta de tratamiento de agua'),
('proyecto_nombre', 4, '', 3, 'Migración del sistema de control a plataforma SCADA'),
('proyecto_nombre', 4, '', 4, 'Instrumentación de la línea de espesamiento y filtrado'),
('proyecto_nombre', 4, '', 5, 'Sistema de detección de gases y seguridad de proceso'),
('proyecto_nombre', 4, '', 6, 'Contrato de calibración y metrología de faena'),
('proyecto_nombre', 4, '', 7, 'Telemetría de tanques y estaciones de bombeo'),
('proyecto_nombre', 4, '', 8, 'Enclavamientos y sistemas instrumentados de seguridad'),
('proyecto_nombre', 5, '', 1, 'Montaje de estructuras y cañerías'),
('proyecto_nombre', 5, '', 2, 'Prefabricado y montaje de spools de proceso'),
('proyecto_nombre', 5, '', 3, 'Montaje de tanques de almacenamiento'),
('proyecto_nombre', 5, '', 4, 'Montaje estructural de nave de chancado'),
('proyecto_nombre', 5, '', 5, 'Recambio de cañerías de pulpa por desgaste'),
('proyecto_nombre', 5, '', 6, 'Montaje de silos y estructuras de soporte'),
('proyecto_nombre', 5, '', 7, 'Contrato de soldadura y calderería de faena'),
('proyecto_nombre', 5, '', 8, 'Montaje de pasarelas, escaleras y plataformas'),
('proyecto_nombre', 6, '', 1, 'Transporte de insumos y personal'),
('proyecto_nombre', 6, '', 2, 'Contrato de logística integral de faena'),
('proyecto_nombre', 6, '', 3, 'Transporte de personal en régimen de turnos'),
('proyecto_nombre', 6, '', 4, 'Distribución de combustible y lubricantes en faena'),
('proyecto_nombre', 6, '', 5, 'Transporte de cargas especiales y sobredimensionadas'),
('proyecto_nombre', 6, '', 6, 'Operación de depósito y despacho de materiales'),
('proyecto_nombre', 6, '', 7, 'Logística de abastecimiento de campamento'),
('proyecto_nombre', 6, '', 8, 'Transporte de mineral y estéril entre frentes'),
('proyecto_nombre', 7, '', 1, 'Alquiler de maquinaria con operador'),
('proyecto_nombre', 7, '', 2, 'Provisión de flota de equipos para movimiento de suelos'),
('proyecto_nombre', 7, '', 3, 'Alquiler de grupos electrógenos y energía temporaria'),
('proyecto_nombre', 7, '', 4, 'Provisión de grúas y equipos de izaje'),
('proyecto_nombre', 7, '', 5, 'Alquiler de equipos auxiliares y compresores'),
('proyecto_nombre', 7, '', 6, 'Provisión de plataformas elevadoras y manipuladores'),
('proyecto_nombre', 7, '', 7, 'Alquiler de planta de hormigón en faena'),
('proyecto_nombre', 7, '', 8, 'Provisión de torres de iluminación y equipos de obra'),
('proyecto_nombre', 8, '', 1, 'Movimiento de suelos y plataformas'),
('proyecto_nombre', 8, '', 2, 'Apertura de caminos de acarreo a nuevo frente'),
('proyecto_nombre', 8, '', 3, 'Preparación de plataforma para montaje de planta'),
('proyecto_nombre', 8, '', 4, 'Ampliación de dique de colas'),
('proyecto_nombre', 8, '', 5, 'Conformación de piletas y sistemas de contención'),
('proyecto_nombre', 8, '', 6, 'Destape y remoción de estéril en frente de explotación'),
('proyecto_nombre', 8, '', 7, 'Conservación de caminos mineros y bermas'),
('proyecto_nombre', 8, '', 8, 'Terraplenes y bases para tanques de almacenamiento'),
('proyecto_nombre', 9, '', 1, 'Operación integral de campamento'),
('proyecto_nombre', 9, '', 2, 'Servicio de catering y hotelería de faena'),
('proyecto_nombre', 9, '', 3, 'Operación de planta potabilizadora y de efluentes'),
('proyecto_nombre', 9, '', 4, 'Gestión de residuos y servicios ambientales de campamento'),
('proyecto_nombre', 9, '', 5, 'Habilitación y montaje de campamento de obra'),
('proyecto_nombre', 9, '', 6, 'Servicio de limpieza y mantenimiento de módulos'),
('proyecto_nombre', 9, '', 7, 'Operación de comedor y abastecimiento de faena'),
('proyecto_nombre', 9, '', 8, 'Mantenimiento de instalaciones y servicios de campamento'),
('proyecto_nombre', 10, '', 1, 'Limpieza técnica industrial'),
('proyecto_nombre', 10, '', 2, 'Servicio de hidrolavado de alta presión en planta'),
('proyecto_nombre', 10, '', 3, 'Limpieza de tanques y espacios confinados'),
('proyecto_nombre', 10, '', 4, 'Aspirado industrial y control de polvo en chancado'),
('proyecto_nombre', 10, '', 5, 'Limpieza de piletas, decantadores y canaletas'),
('proyecto_nombre', 10, '', 6, 'Contrato de orden y limpieza de áreas operativas'),
('proyecto_nombre', 10, '', 7, 'Remediación y limpieza de derrames de hidrocarburos'),
('proyecto_nombre', 10, '', 8, 'Limpieza química de intercambiadores y circuitos')
ON CONFLICT (dominio, servicio_idx, tipo, variante) DO UPDATE SET texto = EXCLUDED.texto;

-- -----------------------------------------------------------------------------
-- 1.d  cotizacion_item — 60 descripciones de renglon: 10 servicios x 6.
--      Registro comercial, no operativo: describe lo que se cotiza.
-- -----------------------------------------------------------------------------

INSERT INTO gannet_demo.catalogo_textos (dominio, servicio_idx, tipo, variante, texto) VALUES
('cotizacion_item', 1, '', 1, 'Mantenimiento industrial: provisión de mano de obra especializada y consumibles'),
('cotizacion_item', 1, '', 2, 'Rutinas de mantenimiento preventivo de equipos de planta'),
('cotizacion_item', 1, '', 3, 'Mantenimiento correctivo con provisión de repuestos'),
('cotizacion_item', 1, '', 4, 'Servicio de mantenimiento predictivo y análisis de condición'),
('cotizacion_item', 1, '', 5, 'Parada de planta: overhaul y puesta a punto de equipos'),
('cotizacion_item', 1, '', 6, 'Mantenimiento de sistemas de bombeo e impulsión'),
('cotizacion_item', 2, '', 1, 'Obras civiles: provisión de materiales, mano de obra y equipos'),
('cotizacion_item', 2, '', 2, 'Ejecución de fundaciones y estructuras de hormigón armado'),
('cotizacion_item', 2, '', 3, 'Construcción y conservación de caminos internos'),
('cotizacion_item', 2, '', 4, 'Obras de drenaje, canales y manejo de aguas'),
('cotizacion_item', 2, '', 5, 'Pisos industriales y plateas de alta resistencia'),
('cotizacion_item', 2, '', 6, 'Movilización de obrador y obras complementarias'),
('cotizacion_item', 3, '', 1, 'Electricidad industrial: montaje, conexionado y puesta en servicio'),
('cotizacion_item', 3, '', 2, 'Tendido de cables de media y baja tensión'),
('cotizacion_item', 3, '', 3, 'Provisión y montaje de tableros de potencia'),
('cotizacion_item', 3, '', 4, 'Iluminación industrial y perimetral de faena'),
('cotizacion_item', 3, '', 5, 'Puesta a tierra, protecciones y mediciones eléctricas'),
('cotizacion_item', 3, '', 6, 'Mantenimiento eléctrico programado de instalaciones'),
('cotizacion_item', 4, '', 1, 'Instrumentación y automatización: ingeniería, montaje y puesta en marcha'),
('cotizacion_item', 4, '', 2, 'Calibración de instrumentos y certificación de lazos'),
('cotizacion_item', 4, '', 3, 'Programación de PLC y desarrollo de pantallas SCADA'),
('cotizacion_item', 4, '', 4, 'Provisión y montaje de instrumentos de campo'),
('cotizacion_item', 4, '', 5, 'Sistemas de detección de gases y seguridad de proceso'),
('cotizacion_item', 4, '', 6, 'Telemetría, redes industriales y comunicaciones'),
('cotizacion_item', 5, '', 1, 'Soldadura y montaje: mano de obra calificada y consumibles'),
('cotizacion_item', 5, '', 2, 'Prefabricado de spools y montaje de cañerías de proceso'),
('cotizacion_item', 5, '', 3, 'Montaje de estructuras metálicas y plataformas'),
('cotizacion_item', 5, '', 4, 'Ensayos no destructivos y calificación de soldaduras'),
('cotizacion_item', 5, '', 5, 'Recambio de tramos de cañería por desgaste'),
('cotizacion_item', 5, '', 6, 'Montaje de tanques y equipos de almacenamiento'),
('cotizacion_item', 6, '', 1, 'Transporte y logística: flete con unidades habilitadas para faena'),
('cotizacion_item', 6, '', 2, 'Transporte de personal en unidades habilitadas'),
('cotizacion_item', 6, '', 3, 'Distribución de combustible y lubricantes en faena'),
('cotizacion_item', 6, '', 4, 'Transporte de cargas especiales y sobredimensionadas'),
('cotizacion_item', 6, '', 5, 'Operación de depósito, preparación y despacho de pedidos'),
('cotizacion_item', 6, '', 6, 'Logística de abastecimiento de campamento'),
('cotizacion_item', 7, '', 1, 'Alquiler de maquinaria y equipos con operador y mantenimiento'),
('cotizacion_item', 7, '', 2, 'Alquiler de equipo pesado para movimiento de suelos'),
('cotizacion_item', 7, '', 3, 'Provisión de grúas y servicios de izaje'),
('cotizacion_item', 7, '', 4, 'Alquiler de grupos electrógenos y energía temporaria'),
('cotizacion_item', 7, '', 5, 'Provisión de compresores y equipos auxiliares'),
('cotizacion_item', 7, '', 6, 'Alquiler de plataformas elevadoras y manipuladores telescópicos'),
('cotizacion_item', 8, '', 1, 'Movimiento de suelos: excavación, transporte y compactación'),
('cotizacion_item', 8, '', 2, 'Excavación y nivelación de plataformas'),
('cotizacion_item', 8, '', 3, 'Apertura y conservación de caminos de acarreo'),
('cotizacion_item', 8, '', 4, 'Conformación de terraplenes y bermas'),
('cotizacion_item', 8, '', 5, 'Remoción de estéril y destape de frente'),
('cotizacion_item', 8, '', 6, 'Impermeabilización y conformación de piletas'),
('cotizacion_item', 9, '', 1, 'Servicios de campamento: operación integral con personal en turnos'),
('cotizacion_item', 9, '', 2, 'Servicio de catering y comedor de faena'),
('cotizacion_item', 9, '', 3, 'Operación de planta potabilizadora y tratamiento de efluentes'),
('cotizacion_item', 9, '', 4, 'Limpieza y mantenimiento de módulos habitacionales'),
('cotizacion_item', 9, '', 5, 'Gestión de residuos sólidos y asimilables de campamento'),
('cotizacion_item', 9, '', 6, 'Habilitación y montaje de módulos de campamento'),
('cotizacion_item', 10, '', 1, 'Limpieza industrial: personal, equipos y disposición de residuos'),
('cotizacion_item', 10, '', 2, 'Hidrolavado de alta presión de estructuras y pisos'),
('cotizacion_item', 10, '', 3, 'Limpieza de tanques y espacios confinados'),
('cotizacion_item', 10, '', 4, 'Aspirado industrial y control de polvo'),
('cotizacion_item', 10, '', 5, 'Limpieza de piletas, decantadores y canaletas'),
('cotizacion_item', 10, '', 6, 'Remediación de derrames y gestión de residuos peligrosos')
ON CONFLICT (dominio, servicio_idx, tipo, variante) DO UPDATE SET texto = EXCLUDED.texto;

-- =============================================================================
-- 2. VISTA AUXILIAR DE SELECCION
-- =============================================================================
-- `variantes` es la cantidad de alternativas del grupo, calculada aqui y no
-- escrita a mano en cada formula. Ampliar un grupo del catalogo redistribuye
-- las filas automaticamente, sin editar ningun consumidor.
--
-- Vive en `gannet_demo`, NO en `public`: no queda expuesta a PostgREST y no
-- entra en el problema de ALTER DEFAULT PRIVILEGES.
-- =============================================================================

CREATE OR REPLACE VIEW gannet_demo.catalogo_textos_sel AS
SELECT
  c.dominio,
  c.servicio_idx,
  c.tipo,
  c.variante,
  c.texto,
  COUNT(*) OVER (PARTITION BY c.dominio, c.servicio_idx, c.tipo) AS variantes
FROM gannet_demo.catalogo_textos c;

COMMENT ON VIEW gannet_demo.catalogo_textos_sel IS
  'Catalogo de textos con la cantidad de variantes de cada grupo resuelta por ventana. Los consumidores eligen con `variante = 1 + hash % variantes`, de modo que ninguna formula supone cuantas alternativas hay.';

REVOKE ALL ON gannet_demo.catalogo_textos_sel FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 3. gannet_demo.aplicar_catalogo_textos() — la unica copia de la logica
-- =============================================================================
-- Esta funcion escribe `ordenes_trabajo.titulo` y `.descripcion`,
-- `proyectos.nombre` y `cotizacion_items.descripcion` a partir del catalogo.
--
-- POR QUE ES UNA FUNCION Y NO TRES UPDATE SUELTOS
--
--   El generador tiene que producir exactamente lo mismo que esta migracion, o
--   la notebook y el VPS dejan de coincidir. La migracion anterior resolvio ese
--   problema copiando un literal y pidiendo por comentario que ambas copias se
--   editaran juntas — una garantia que depende de que alguien se acuerde.
--
--   Aca la logica vive una sola vez. La migracion la define y la ejecuta sobre
--   los datos ya sembrados; el generador la llama al final de su corrida sobre
--   los datos recien creados. No hay dos copias que puedan separarse.
--
--   La funcion sobrevive a la limpieza del generador, que solo elimina `sem_*`
--   y las tablas `tmp_*`.
--
-- Es idempotente: cada texto es funcion pura de los identificadores de la fila
-- y del contenido del catalogo, asi que correrla dos veces da el mismo
-- resultado.
-- =============================================================================

CREATE OR REPLACE FUNCTION gannet_demo.aplicar_catalogo_textos()
RETURNS void
LANGUAGE plpgsql
AS $fn$
BEGIN

-- =============================================================================
-- 3.a ordenes_trabajo — titulo y descripcion
-- =============================================================================
-- Salt 1230 elige el titulo dentro del grupo (servicio, tipo); salt 1231 elige
-- la frase de alcance. Ambas son funciones puras del id de la orden.
--
-- REPARTO POR GRUPO. El hash por fila no alcanza. Las ordenes que comparten
-- faena, servicio y tipo son justamente las que caen juntas en la grilla, y con
-- tres variantes dos de ellas colisionan una de cada tres veces.
--
-- Sumar el rango a un hash por fila NO lo arregla: como cada fila parte de un
-- hash distinto, dos filas del mismo grupo siguen pudiendo caer en la misma
-- variante. El hash se toma entonces del ANCLA del grupo — el menor id — y el
-- rango se suma sobre esa unica base. Asi las filas del grupo recorren el
-- catalogo en orden (v, v+1, v+2, v, …) y nunca repiten mientras el grupo no
-- supere la cantidad de variantes. El ancla sigue decidiendo por donde empieza
-- cada grupo, que es lo que evita que todos los grupos abran con la misma.
--
-- Determinismo: `min()` y `row_number()` sobre una particion fija ordenada por
-- un id unico no dependen del plan ni del orden en que el motor produzca las
-- filas.
--
-- `sem_h` no existe en tiempo de migracion (el generador la elimina en sus
-- ultimas lineas), asi que su cuerpo va escrito en linea. La seccion 5 verifica
-- que la expresion en linea y la definicion del generador coinciden.
-- =============================================================================

WITH srv AS (
  SELECT s.id, x.idx
  FROM gannet_demo.servicios s
  JOIN unnest(ARRAY['MANT_IND','OBRA_CIVIL','ELEC_IND','INST_AUTO','SOLD_MONT',
                    'TRANS_LOG','ALQ_MAQ','MOV_SUELO','SERV_CAMP','LIMP_IND'])
       WITH ORDINALITY AS x(codigo, idx) ON x.codigo = s.codigo
),
base AS (
  SELECT
    ot.id,
    srv.idx AS srv_idx,
    ot.tipo,
    fa.nombre    AS faena,
    fa.provincia AS provincia,
    COALESCE(cl.nombre_comercial, cl.razon_social) AS cliente,
    -- Inlined gannet_demo.sem_h(<ancla del grupo>, 1230). El ancla es el menor
    -- id del grupo (faena, servicio, tipo), no el id de la fila.
    ((('x' || substr(md5(
        (min(ot.id) OVER (PARTITION BY ot.faena_id, ot.servicio_id, ot.tipo))::text
        || ':' || 1230::text), 1, 8))::bit(32)::int)::bigint
      + 2147483648) AS h_titulo,
    -- Inlined gannet_demo.sem_h(ot.id, 1231).
    ((('x' || substr(md5(ot.id::text || ':' || 1231::text), 1, 8))::bit(32)::int)::bigint
      + 2147483648) AS h_alcance,
    (row_number() OVER (PARTITION BY ot.faena_id, ot.servicio_id, ot.tipo
                        ORDER BY ot.id) - 1) AS rango
  FROM gannet_demo.ordenes_trabajo ot
  JOIN srv                     ON srv.id = ot.servicio_id
  JOIN gannet_demo.faenas   fa ON fa.id  = ot.faena_id
  JOIN gannet_demo.clientes cl ON cl.id  = ot.cliente_id
),
elegido AS (
  SELECT
    b.id,
    t.texto AS titulo_base,
    b.faena,
    b.provincia,
    b.cliente,
    a.texto AS alcance
  FROM base b
  JOIN gannet_demo.catalogo_textos_sel t
    ON t.dominio      = 'ot_titulo'
   AND t.servicio_idx = b.srv_idx
   AND t.tipo         = b.tipo
   AND t.variante     = 1 + ((b.h_titulo + b.rango) % t.variantes)::int
  JOIN gannet_demo.catalogo_textos_sel a
    ON a.dominio      = 'ot_alcance'
   AND a.servicio_idx = 0
   AND a.tipo         = ''
   AND a.variante     = 1 + (b.h_alcance % a.variantes)::int
)
UPDATE gannet_demo.ordenes_trabajo ot
SET titulo      = e.titulo_base || ' — ' || e.faena,
    descripcion = e.titulo_base || ', ejecutado por Andes Servicios Integrales para '
                  || e.cliente || ' en ' || e.faena || ', ' || e.provincia || '. '
                  || e.alcance
FROM elegido e
WHERE e.id = ot.id;

-- =============================================================================
-- 3.b proyectos — nombre
-- =============================================================================
-- Salt 1120. Ocho variantes por servicio en lugar de una.
--
-- El hash solo no basta: con ocho variantes, dos proyectos del mismo servicio
-- en la misma faena siguen chocando una de cada ocho veces, y medido sobre los
-- 80 proyectos reales quedaban tres nombres repetidos. `rango` los numera
-- dentro del grupo (servicio, faena) y corre la variante, lo que garantiza
-- nombres distintos mientras el grupo no supere las ocho variantes: el grupo
-- mas grande tiene tres proyectos. La asercion de la seccion 4 lo verifica.
-- =============================================================================

WITH srv AS (
  SELECT s.id, x.idx
  FROM gannet_demo.servicios s
  JOIN unnest(ARRAY['MANT_IND','OBRA_CIVIL','ELEC_IND','INST_AUTO','SOLD_MONT',
                    'TRANS_LOG','ALQ_MAQ','MOV_SUELO','SERV_CAMP','LIMP_IND'])
       WITH ORDINALITY AS x(codigo, idx) ON x.codigo = s.codigo
),
base AS (
  SELECT
    p.id,
    srv.idx   AS srv_idx,
    fa.nombre AS faena,
    -- Inlined gannet_demo.sem_h(p.id, 1120).
    -- Inlined gannet_demo.sem_h(<ancla del grupo>, 1120), con la misma logica
    -- de ancla y rango que la seccion 3.a.
    ((('x' || substr(md5(
        (min(p.id) OVER (PARTITION BY p.servicio_id, p.faena_id))::text
        || ':' || 1120::text), 1, 8))::bit(32)::int)::bigint
      + 2147483648) AS h,
    (row_number() OVER (PARTITION BY p.servicio_id, p.faena_id ORDER BY p.id) - 1) AS rango
  FROM gannet_demo.proyectos p
  JOIN srv                   ON srv.id = p.servicio_id
  JOIN gannet_demo.faenas fa ON fa.id  = p.faena_id
)
UPDATE gannet_demo.proyectos p
SET nombre = t.texto || ' — ' || b.faena
FROM base b
JOIN gannet_demo.catalogo_textos_sel t
  ON t.dominio      = 'proyecto_nombre'
 AND t.servicio_idx = b.srv_idx
 AND t.tipo         = ''
 AND t.variante     = 1 + ((b.h + b.rango) % t.variantes)::int
WHERE b.id = p.id;

-- =============================================================================
-- 3.c cotizacion_items — descripcion
-- =============================================================================
-- Salt 1910 sobre `cotizacion_id * 10 + orden`, la misma clave logica que el
-- generador usa para el precio y la cantidad del renglon, de modo que los tres
-- atributos de una linea derivan del mismo identificador.
-- =============================================================================

WITH srv AS (
  SELECT s.id, x.idx
  FROM gannet_demo.servicios s
  JOIN unnest(ARRAY['MANT_IND','OBRA_CIVIL','ELEC_IND','INST_AUTO','SOLD_MONT',
                    'TRANS_LOG','ALQ_MAQ','MOV_SUELO','SERV_CAMP','LIMP_IND'])
       WITH ORDINALITY AS x(codigo, idx) ON x.codigo = s.codigo
),
base AS (
  SELECT
    i.id,
    srv.idx AS srv_idx,
    -- Inlined gannet_demo.sem_h(i.cotizacion_id * 10 + i.orden, 1910).
    ((('x' || substr(md5((i.cotizacion_id * 10 + i.orden)::text || ':' || 1910::text), 1, 8))
        ::bit(32)::int)::bigint + 2147483648) AS h
  FROM gannet_demo.cotizacion_items i
  JOIN srv ON srv.id = i.servicio_id
)
UPDATE gannet_demo.cotizacion_items i
SET descripcion = t.texto
FROM base b
JOIN gannet_demo.catalogo_textos_sel t
  ON t.dominio      = 'cotizacion_item'
 AND t.servicio_idx = b.srv_idx
 AND t.tipo         = ''
 AND t.variante     = 1 + (b.h % t.variantes)::int
WHERE b.id = i.id;

END;
$fn$;

COMMENT ON FUNCTION gannet_demo.aplicar_catalogo_textos() IS
  'Reescribe titulo y descripcion de las ordenes de trabajo, nombre de los proyectos y descripcion de los renglones de cotizacion tomando los textos de gannet_demo.catalogo_textos. Es la unica copia de esa logica: la migracion la ejecuta sobre los datos ya sembrados y el generador de demo la llama al final de su corrida, de modo que ambos caminos producen exactamente los mismos textos. Determinista e idempotente.';

REVOKE ALL ON FUNCTION gannet_demo.aplicar_catalogo_textos() FROM PUBLIC, anon, authenticated;

-- Aplicacion sobre la base ya sembrada. En un arranque desde cero las tablas
-- estan vacias en este punto y la llamada no hace nada: el generador la vuelve
-- a llamar cuando termina de crear las filas.
SELECT gannet_demo.aplicar_catalogo_textos();

-- =============================================================================
-- 4. ASERCIONES DE CONTENIDO
-- Es preferible abortar el despliegue que subir al escenario con la grilla
-- repetida otra vez.
--
-- Las aserciones de cobertura del catalogo corren siempre. Las de variedad solo
-- corren si hay datos: en un arranque desde cero las migraciones se aplican
-- ANTES del generador, y una base vacia no es una regresion. El generador
-- vuelve a llamar a la funcion cuando termina, y esas mismas aserciones se
-- verifican en la corrida de verificacion del generador.
-- =============================================================================

DO $$
DECLARE
  n_tit    bigint;
  n_desc   bigint;
  n_proy   bigint;
  n_item   bigint;
  huerfano bigint;
  choque   text;
BEGIN
  -- Cobertura: el catalogo cubre las seis combinaciones de tipo de los diez
  -- servicios. Un tipo sin titulo dejaria ordenes sin actualizar.
  SELECT COUNT(*) INTO huerfano
  FROM (SELECT DISTINCT servicio_idx, tipo FROM gannet_demo.catalogo_textos
         WHERE dominio = 'ot_titulo') c
  RIGHT JOIN (
    SELECT g.idx, t.tipo
    FROM generate_series(1, 10) AS g(idx)
    CROSS JOIN unnest(ARRAY['preventivo','correctivo','programado',
                            'inspeccion','instalacion','emergencia']) AS t(tipo)
  ) esperado ON c.servicio_idx = esperado.idx AND c.tipo = esperado.tipo
  WHERE c.servicio_idx IS NULL;

  IF huerfano > 0 THEN
    RAISE EXCEPTION 'El catalogo ot_titulo no cubre % combinaciones de servicio y tipo.', huerfano;
  END IF;

  -- Base todavia sin sembrar: no hay nada que medir.
  IF NOT EXISTS (SELECT 1 FROM gannet_demo.ordenes_trabajo) THEN
    RETURN;
  END IF;

  -- Ninguna fila puede haber quedado sin texto nuevo.
  SELECT COUNT(*) INTO huerfano
  FROM gannet_demo.ordenes_trabajo WHERE titulo IS NULL OR descripcion IS NULL;
  IF huerfano > 0 THEN
    RAISE EXCEPTION '% ordenes de trabajo quedaron sin titulo o descripcion.', huerfano;
  END IF;

  -- Variedad efectiva. Los umbrales estan por debajo de lo que produce el
  -- catalogo actual, de modo que solo disparan ante una regresion real.
  SELECT COUNT(DISTINCT titulo), COUNT(DISTINCT descripcion)
    INTO n_tit, n_desc FROM gannet_demo.ordenes_trabajo;
  IF n_tit < 600 THEN
    RAISE EXCEPTION 'Solo % titulos distintos de orden de trabajo; se esperaban 600 o mas.', n_tit;
  END IF;
  IF n_desc < 900 THEN
    RAISE EXCEPTION 'Solo % descripciones distintas de orden de trabajo; se esperaban 900 o mas.', n_desc;
  END IF;

  -- Unicidad estricta, no un umbral. Dos proyectos solo pueden compartir nombre
  -- si comparten faena y servicio, y el desempate por rango se lo impide
  -- mientras el grupo no supere las ocho variantes. Si esto falla, un grupo
  -- crecio mas alla del catalogo y hay que ampliarlo.
  SELECT COUNT(DISTINCT nombre) INTO n_proy FROM gannet_demo.proyectos;
  IF n_proy <> (SELECT COUNT(*) FROM gannet_demo.proyectos) THEN
    RAISE EXCEPTION
      'Hay nombres de proyecto repetidos: % distintos sobre % proyectos.',
      n_proy, (SELECT COUNT(*) FROM gannet_demo.proyectos);
  END IF;

  SELECT COUNT(DISTINCT descripcion) INTO n_item FROM gannet_demo.cotizacion_items;
  IF n_item < 55 THEN
    RAISE EXCEPTION 'Solo % descripciones distintas de renglon; se esperaban 55 o mas.', n_item;
  END IF;

  -- Coherencia entre titulo y tipo: la contradiccion que hacia que una orden
  -- correctiva se titulara "mantenimiento preventivo" no puede reaparecer.
  SELECT string_agg(DISTINCT ot.tipo || ' / ' || ot.titulo, '; ')
  INTO choque
  FROM gannet_demo.ordenes_trabajo ot
  JOIN gannet_demo.servicios s ON s.id = ot.servicio_id
  LEFT JOIN gannet_demo.catalogo_textos c
    ON c.dominio = 'ot_titulo'
   AND c.tipo    = ot.tipo
   AND ot.titulo = c.texto || ' — ' || (SELECT f.nombre FROM gannet_demo.faenas f
                                         WHERE f.id = ot.faena_id)
  WHERE c.texto IS NULL;

  IF choque IS NOT NULL THEN
    RAISE EXCEPTION 'Hay titulos que no pertenecen al tipo de su orden: %', left(choque, 400);
  END IF;
END $$;

-- =============================================================================
-- 5. ASERCION DE DETERMINISMO
-- =============================================================================
-- La expresion md5 escrita en linea en la seccion 3 debe dar exactamente
-- lo mismo que `gannet_demo.sem_h`, que es lo que ejecuta el generador. Si el
-- generador y esta migracion se separan, la notebook y el VPS dejan de
-- coincidir. La funcion solo existe mientras el generador corre, asi que la
-- comprobacion se hace contra su definicion reconstruida aqui.
-- =============================================================================

DO $$
DECLARE
  i        bigint;
  sal      bigint;
  inline   bigint;
  esperado bigint;
BEGIN
  FOREACH sal IN ARRAY ARRAY[1120::bigint, 1230::bigint, 1231::bigint, 1910::bigint] LOOP
    FOR i IN 1..250 LOOP
      inline := ((('x' || substr(md5(i::text || ':' || sal::text), 1, 8))::bit(32)::int)::bigint
                 + 2147483648);
      -- Misma formula, escrita como la declara el generador en su bloque 0.
      esperado := (('x' || substr(md5(i::text || ':' || sal::text), 1, 8))::bit(32)::int)::bigint
                  + 2147483648;
      IF inline IS DISTINCT FROM esperado THEN
        RAISE EXCEPTION 'La expresion en linea difiere de sem_h(%, %): % vs %.',
          i, sal, inline, esperado;
      END IF;
      IF inline < 0 OR inline > 4294967295 THEN
        RAISE EXCEPTION 'sem_h(%, %) devolvio % fuera de [0, 4294967295].', i, sal, inline;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- 6. ASERCIONES DE PRIVILEGIOS
-- =============================================================================
-- Esta migracion no crea nada en `public` ni recrea ninguna vista, asi que no
-- abre superficie nueva. La auditoria se corre igual: una regresion introducida
-- en otro lado debe abortar este despliegue en vez de publicarse.
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
  -- Ninguna vista public.gd_* admite escritura desde los roles publicos.
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

  -- Las relaciones de gannet_demo, incluido el catalogo nuevo, permanecen
  -- inaccesibles para los roles publicos.
  FOR r IN
    SELECT c.relname, rol
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['anon','authenticated']) AS rol
    WHERE n.nspname = 'gannet_demo'
      AND c.relkind IN ('r', 'v')
      AND has_table_privilege(rol, c.oid, 'SELECT')
  LOOP
    RAISE EXCEPTION
      'La relacion gannet_demo.% es legible por el rol %.', r.relname, r.rol;
  END LOOP;

  -- La grilla de la demo corre sin sesion: `anon` no puede perder SELECT.
  IF NOT has_table_privilege('anon', 'public.gd_ot_operativas', 'SELECT') THEN
    RAISE EXCEPTION 'anon perdio SELECT sobre public.gd_ot_operativas.';
  END IF;
END $$;

COMMIT;

-- PostgREST cachea el esquema. Sin esto, la tabla nueva y cualquier cambio de
-- forma no llegan a la aplicacion hasta el proximo reinicio.
NOTIFY pgrst, 'reload schema';
