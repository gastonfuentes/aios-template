-- =============================================================================
-- ESQUEMA `gannet_demo` — Andes Servicios Integrales S.A.
-- =============================================================================
--
-- QUE MODELA
--   La operacion completa de "Andes Servicios Integrales S.A.", una empresa
--   ficticia proveedora multidisciplinaria de la industria minera. La empresa es
--   el SUJETO del sistema; las companias mineras son sus CLIENTES.
--
--   Esta orientacion invierte la del esquema legado `demo_mineria`, donde el
--   sujeto era la minera y los proveedores eran observados. Ambos esquemas
--   conviven durante la transicion y no comparten tablas.
--
-- ALCANCE DE ESTA MIGRACION
--   Esquema, 24 tablas, restricciones, indices, semilla de servicios, ROW LEVEL
--   SECURITY en modo negacion por defecto y privilegios de service_role.
--   Las vistas de lectura `public.gd_*` que consume Mission Control se crean en
--   una migracion posterior; alli se concede SELECT a `anon` y `authenticated`.
--
-- CONVENCIONES
--   * Clave primaria: `bigint GENERATED ALWAYS AS IDENTITY`.
--   * Auditoria minima: `creado_en timestamptz NOT NULL DEFAULT now()`.
--   * Enumeraciones: `text` con `CHECK (col IN (...))`, no tipos ENUM, para que
--     agregar un valor sea una migracion trivial durante la preparacion de la
--     demo.
--   * Importes monetarios: `numeric(14,2)` con sufijo `_ars` (pesos argentinos).
--   * Nombres de tablas, columnas y comentarios en espanol.
--
-- COMENTARIOS COMO DICCIONARIO SEMANTICO
--   Cada tabla y cada columna no evidente lleva `COMMENT`. El modulo de IA
--   conversacional los lee para traducir preguntas en lenguaje natural a SQL.
--   Todo agregado futuro a este esquema debe venir con su comentario.
--
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS gannet_demo;

COMMENT ON SCHEMA gannet_demo IS
  'Operacion de Andes Servicios Integrales S.A., empresa ficticia proveedora multidisciplinaria de mineria usada en la demo comercial. La empresa es el sujeto del sistema y las companias mineras son sus clientes.';

-- =============================================================================
-- 1. servicios — catalogo de las diez lineas de negocio
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.servicios (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                text NOT NULL UNIQUE,
  nombre                text NOT NULL,
  descripcion           text,
  unidad_facturacion    text NOT NULL CHECK (unidad_facturacion IN ('hora','jornada','mes','unidad','m2','m3','tonelada','km','global')),
  color_hex             text,
  activo                boolean NOT NULL DEFAULT true,
  creado_en             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.servicios IS
  'Catalogo de las diez lineas de servicio que Andes Servicios Integrales presta a la mineria. Es la dimension que clasifica proyectos, ordenes de trabajo, cotizaciones, equipos y especialidades del personal.';
COMMENT ON COLUMN gannet_demo.servicios.codigo IS
  'Codigo corto e inmutable del servicio, usado como referencia estable en codigos de proyecto y reportes. Ejemplos: MANT_IND, OBRA_CIVIL, ELEC_IND.';
COMMENT ON COLUMN gannet_demo.servicios.nombre IS
  'Denominacion comercial del servicio tal como se muestra al cliente.';
COMMENT ON COLUMN gannet_demo.servicios.descripcion IS
  'Detalle del alcance tipico del servicio.';
COMMENT ON COLUMN gannet_demo.servicios.unidad_facturacion IS
  'Unidad economica en la que se cotiza y factura el servicio: hora, jornada, mes, unidad, m2, m3, tonelada, km o global (monto cerrado por obra).';
COMMENT ON COLUMN gannet_demo.servicios.color_hex IS
  'Color de identidad del servicio en formato hexadecimal, usado por graficos y etiquetas del panel.';
COMMENT ON COLUMN gannet_demo.servicios.activo IS
  'Indica si el servicio se sigue comercializando. Los inactivos se conservan por integridad historica.';
COMMENT ON COLUMN gannet_demo.servicios.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 2. empleados — dotacion propia de Andes
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.empleados (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  legajo                    text NOT NULL UNIQUE,
  nombre                    text NOT NULL,
  apellido                  text NOT NULL,
  documento                 text,
  puesto                    text,
  area                      text NOT NULL CHECK (area IN ('operaciones','mantenimiento','logistica','administracion','comercial','seguridad_higiene','deposito','direccion')),
  especialidad_servicio_id  bigint REFERENCES gannet_demo.servicios(id),
  supervisor_id             bigint REFERENCES gannet_demo.empleados(id),
  modalidad_turno           text CHECK (modalidad_turno IN ('jornada','4x3','7x7','14x14','guardia')),
  fecha_ingreso             date,
  costo_hora_ars            numeric(14,2),
  email                     text,
  telefono                  text,
  estado                    text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','licencia','suspendido','baja')),
  creado_en                 timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.empleados IS
  'Dotacion propia de Andes Servicios Integrales. Incluye personal operativo, tecnico, administrativo y de direccion. No modela personal de los clientes ni de subcontratistas.';
COMMENT ON COLUMN gannet_demo.empleados.legajo IS
  'Numero de legajo interno, identificador de negocio unico del empleado.';
COMMENT ON COLUMN gannet_demo.empleados.documento IS
  'Numero de documento nacional de identidad.';
COMMENT ON COLUMN gannet_demo.empleados.puesto IS
  'Denominacion del puesto, en texto libre. Ejemplos: soldador, jefe de obra, tecnico instrumentista.';
COMMENT ON COLUMN gannet_demo.empleados.area IS
  'Area organizativa a la que pertenece el empleado.';
COMMENT ON COLUMN gannet_demo.empleados.especialidad_servicio_id IS
  'Servicio en el que el empleado esta especializado. Permite asignar personal idoneo a cada orden de trabajo.';
COMMENT ON COLUMN gannet_demo.empleados.supervisor_id IS
  'Referencia al empleado que lo supervisa. Autorreferencia que construye el organigrama.';
COMMENT ON COLUMN gannet_demo.empleados.modalidad_turno IS
  'Regimen de trabajo: jornada estandar, o esquemas rotativos de faena minera 4x3, 7x7, 14x14, o guardia pasiva.';
COMMENT ON COLUMN gannet_demo.empleados.fecha_ingreso IS
  'Fecha de ingreso a la empresa, base del calculo de antiguedad.';
COMMENT ON COLUMN gannet_demo.empleados.costo_hora_ars IS
  'Costo empresa por hora del empleado en pesos argentinos. Alimenta el costo de mano de obra de las ordenes de trabajo.';
COMMENT ON COLUMN gannet_demo.empleados.estado IS
  'Situacion de revista: activo, con licencia, suspendido o dado de baja.';
COMMENT ON COLUMN gannet_demo.empleados.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 3. clientes — companias mineras y otros compradores
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.clientes (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  razon_social          text NOT NULL,
  nombre_comercial      text,
  cuit                  text NOT NULL UNIQUE,
  mineral_principal     text CHECK (mineral_principal IN ('litio','cobre','oro','plata','sal','potasio','borato','otro')),
  provincia             text,
  localidad             text,
  ejecutivo_cuenta_id   bigint REFERENCES gannet_demo.empleados(id),
  estado                text NOT NULL DEFAULT 'prospecto' CHECK (estado IN ('prospecto','activo','inactivo','moroso')),
  condicion_pago_dias   integer,
  limite_credito_ars    numeric(14,2),
  fecha_alta            date,
  sitio_web             text,
  creado_en             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.clientes IS
  'Clientes de Andes Servicios Integrales: mayoritariamente companias mineras que contratan sus servicios. Es la entidad central del modulo comercial.';
COMMENT ON COLUMN gannet_demo.clientes.razon_social IS
  'Denominacion legal completa del cliente, la que figura en la factura.';
COMMENT ON COLUMN gannet_demo.clientes.nombre_comercial IS
  'Nombre de uso corriente del cliente, el que se muestra en pantallas y reportes.';
COMMENT ON COLUMN gannet_demo.clientes.cuit IS
  'Clave Unica de Identificacion Tributaria del cliente. Identificador fiscal unico.';
COMMENT ON COLUMN gannet_demo.clientes.mineral_principal IS
  'Mineral que el cliente explota principalmente. Segmenta la cartera por tipo de mineria.';
COMMENT ON COLUMN gannet_demo.clientes.provincia IS
  'Provincia argentina donde el cliente tiene su operacion principal.';
COMMENT ON COLUMN gannet_demo.clientes.localidad IS
  'Localidad de la operacion o sede principal del cliente.';
COMMENT ON COLUMN gannet_demo.clientes.ejecutivo_cuenta_id IS
  'Empleado del area comercial responsable de la relacion con este cliente.';
COMMENT ON COLUMN gannet_demo.clientes.estado IS
  'Situacion comercial: prospecto sin contratar, activo, inactivo o moroso por deuda vencida.';
COMMENT ON COLUMN gannet_demo.clientes.condicion_pago_dias IS
  'Plazo de pago acordado en dias corridos desde la emision de la factura. Ejemplos habituales: 30, 60, 90.';
COMMENT ON COLUMN gannet_demo.clientes.limite_credito_ars IS
  'Exposicion maxima autorizada para el cliente en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.clientes.fecha_alta IS
  'Fecha en que el cliente fue incorporado a la cartera.';
COMMENT ON COLUMN gannet_demo.clientes.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 4. faenas — emplazamientos del cliente donde se ejecuta el trabajo
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.faenas (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id     bigint NOT NULL REFERENCES gannet_demo.clientes(id),
  nombre         text NOT NULL,
  tipo           text NOT NULL CHECK (tipo IN ('mina','planta','salar','campamento','puerto','deposito')),
  provincia      text,
  altitud_msnm   integer,
  latitud        numeric(9,6),
  longitud       numeric(9,6),
  activa         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT faenas_cliente_nombre_key UNIQUE (cliente_id, nombre)
);

COMMENT ON TABLE gannet_demo.faenas IS
  'Emplazamientos fisicos de los clientes donde Andes presta servicios: minas, plantas, salares, campamentos, puertos y depositos. Un cliente puede tener varias faenas.';
COMMENT ON COLUMN gannet_demo.faenas.cliente_id IS
  'Cliente propietario del emplazamiento.';
COMMENT ON COLUMN gannet_demo.faenas.nombre IS
  'Nombre del emplazamiento. Unico dentro de cada cliente.';
COMMENT ON COLUMN gannet_demo.faenas.tipo IS
  'Naturaleza del emplazamiento, que condiciona el tipo de trabajo y la logistica.';
COMMENT ON COLUMN gannet_demo.faenas.provincia IS
  'Provincia argentina donde se ubica la faena.';
COMMENT ON COLUMN gannet_demo.faenas.altitud_msnm IS
  'Altitud sobre el nivel del mar en metros. Relevante en mineria de altura por su impacto en logistica, rendimiento de equipos y aptitud del personal.';
COMMENT ON COLUMN gannet_demo.faenas.latitud IS
  'Latitud geografica en grados decimales, para representacion en mapa.';
COMMENT ON COLUMN gannet_demo.faenas.longitud IS
  'Longitud geografica en grados decimales, para representacion en mapa.';
COMMENT ON COLUMN gannet_demo.faenas.activa IS
  'Indica si la faena se encuentra operativa.';
COMMENT ON COLUMN gannet_demo.faenas.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 5. contactos — personas de contacto del lado del cliente
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.contactos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cliente_id    bigint NOT NULL REFERENCES gannet_demo.clientes(id),
  faena_id      bigint REFERENCES gannet_demo.faenas(id),
  nombre        text NOT NULL,
  apellido      text NOT NULL,
  cargo         text,
  area          text CHECK (area IN ('operaciones','mantenimiento','compras','contratos','seguridad','administracion','direccion','calidad')),
  email         text,
  telefono      text,
  es_principal  boolean NOT NULL DEFAULT false,
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.contactos IS
  'Personas de contacto dentro de las organizaciones cliente. Son las contrapartes de Andes en compras, contratos y operaciones. No son empleados de Andes.';
COMMENT ON COLUMN gannet_demo.contactos.cliente_id IS
  'Cliente al que pertenece el contacto.';
COMMENT ON COLUMN gannet_demo.contactos.faena_id IS
  'Faena especifica donde trabaja el contacto. Nulo cuando su alcance es corporativo.';
COMMENT ON COLUMN gannet_demo.contactos.cargo IS
  'Cargo del contacto en su organizacion, en texto libre.';
COMMENT ON COLUMN gannet_demo.contactos.area IS
  'Area funcional del contacto dentro del cliente. Determina que tipo de gestion se canaliza a traves suyo.';
COMMENT ON COLUMN gannet_demo.contactos.es_principal IS
  'Marca al contacto de referencia del cliente. Como maximo un contacto principal activo por cliente.';
COMMENT ON COLUMN gannet_demo.contactos.activo IS
  'Indica si el contacto sigue vigente en la organizacion cliente.';
COMMENT ON COLUMN gannet_demo.contactos.creado_en IS
  'Marca temporal de alta del registro.';

CREATE UNIQUE INDEX IF NOT EXISTS contactos_principal_unico_idx
  ON gannet_demo.contactos (cliente_id) WHERE es_principal;

COMMENT ON INDEX gannet_demo.contactos_principal_unico_idx IS
  'Garantiza un unico contacto principal por cliente.';

-- =============================================================================
-- 6. depositos — almacenes propios de Andes
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.depositos (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre          text NOT NULL UNIQUE,
  tipo            text NOT NULL CHECK (tipo IN ('central','faena','movil')),
  faena_id        bigint REFERENCES gannet_demo.faenas(id),
  direccion       text,
  responsable_id  bigint REFERENCES gannet_demo.empleados(id),
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.depositos IS
  'Almacenes de Andes donde se guarda stock, equipos y vehiculos. Pueden ser centrales, estar destacados en una faena de cliente o ser moviles.';
COMMENT ON COLUMN gannet_demo.depositos.tipo IS
  'Naturaleza del deposito: central (base propia), faena (destacado en instalacion del cliente) o movil (contenedor o furgon desplazable).';
COMMENT ON COLUMN gannet_demo.depositos.faena_id IS
  'Faena donde se emplaza el deposito. Se completa cuando el tipo es faena.';
COMMENT ON COLUMN gannet_demo.depositos.direccion IS
  'Domicilio o referencia de ubicacion del deposito.';
COMMENT ON COLUMN gannet_demo.depositos.responsable_id IS
  'Empleado a cargo del deposito.';
COMMENT ON COLUMN gannet_demo.depositos.activo IS
  'Indica si el deposito esta operativo.';
COMMENT ON COLUMN gannet_demo.depositos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 7. vehiculos — flota propia
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.vehiculos (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dominio           text NOT NULL UNIQUE,
  tipo              text NOT NULL CHECK (tipo IN ('camioneta','camion','tractor_semi','minibus','utilitario','grua','hormigonera','cisterna','ambulancia')),
  marca             text,
  modelo            text,
  anio              integer CHECK (anio BETWEEN 1990 AND 2030),
  km_actual         integer,
  estado            text NOT NULL DEFAULT 'operativo' CHECK (estado IN ('operativo','en_mantenimiento','fuera_servicio','baja')),
  responsable_id    bigint REFERENCES gannet_demo.empleados(id),
  deposito_base_id  bigint REFERENCES gannet_demo.depositos(id),
  vtv_vence_el      date,
  seguro_vence_el   date,
  costo_km_ars      numeric(14,2),
  valor_ars         numeric(14,2),
  creado_en         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.vehiculos IS
  'Flota vehicular propia de Andes, desde camionetas de supervision hasta equipos pesados de transporte y servicio. Sostiene el modulo de flota.';
COMMENT ON COLUMN gannet_demo.vehiculos.dominio IS
  'Patente del vehiculo. Identificador de negocio unico.';
COMMENT ON COLUMN gannet_demo.vehiculos.tipo IS
  'Categoria del vehiculo, que determina su uso operativo.';
COMMENT ON COLUMN gannet_demo.vehiculos.anio IS
  'Anio de fabricacion del vehiculo.';
COMMENT ON COLUMN gannet_demo.vehiculos.km_actual IS
  'Ultima lectura conocida del odometro en kilometros. Dispara los mantenimientos preventivos.';
COMMENT ON COLUMN gannet_demo.vehiculos.estado IS
  'Disponibilidad del vehiculo: operativo, en mantenimiento, fuera de servicio o dado de baja.';
COMMENT ON COLUMN gannet_demo.vehiculos.responsable_id IS
  'Empleado que tiene el vehiculo asignado.';
COMMENT ON COLUMN gannet_demo.vehiculos.deposito_base_id IS
  'Deposito donde el vehiculo tiene su base habitual.';
COMMENT ON COLUMN gannet_demo.vehiculos.vtv_vence_el IS
  'Fecha de vencimiento de la verificacion tecnica vehicular. Habilita alertas de documentacion por vencer.';
COMMENT ON COLUMN gannet_demo.vehiculos.seguro_vence_el IS
  'Fecha de vencimiento de la poliza de seguro.';
COMMENT ON COLUMN gannet_demo.vehiculos.costo_km_ars IS
  'Costo operativo por kilometro en pesos argentinos, usado para imputar viajes a las ordenes de trabajo.';
COMMENT ON COLUMN gannet_demo.vehiculos.valor_ars IS
  'Valor patrimonial estimado del vehiculo en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.vehiculos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 8. equipos — maquinaria, herramientas e instrumental
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.equipos (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo_interno        text NOT NULL UNIQUE,
  nombre                text NOT NULL,
  categoria             text NOT NULL CHECK (categoria IN ('herramienta_manual','herramienta_electrica','equipo_pesado','instrumento_medicion','generador','soldadora','compresor','bomba','andamio','epp')),
  servicio_id           bigint REFERENCES gannet_demo.servicios(id),
  marca                 text,
  modelo                text,
  numero_serie          text,
  estado                text NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible','asignado','en_mantenimiento','en_calibracion','fuera_servicio','baja')),
  es_alquilable         boolean NOT NULL DEFAULT false,
  tarifa_dia_ars        numeric(14,2),
  valor_ars             numeric(14,2),
  deposito_id           bigint REFERENCES gannet_demo.depositos(id),
  responsable_id        bigint REFERENCES gannet_demo.empleados(id),
  proxima_calibracion   date,
  creado_en             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.equipos IS
  'Parque de equipos, maquinaria, herramientas e instrumental de Andes. Incluye tanto los activos de uso interno como los que se alquilan al cliente dentro del servicio de alquiler de maquinaria.';
COMMENT ON COLUMN gannet_demo.equipos.codigo_interno IS
  'Codigo de inventario del equipo. Identificador de negocio unico.';
COMMENT ON COLUMN gannet_demo.equipos.categoria IS
  'Familia del equipo, que determina su tratamiento de mantenimiento y calibracion.';
COMMENT ON COLUMN gannet_demo.equipos.servicio_id IS
  'Servicio al que el equipo esta principalmente afectado.';
COMMENT ON COLUMN gannet_demo.equipos.numero_serie IS
  'Numero de serie del fabricante.';
COMMENT ON COLUMN gannet_demo.equipos.estado IS
  'Situacion del equipo: disponible, asignado a un trabajo, en mantenimiento, en calibracion, fuera de servicio o dado de baja.';
COMMENT ON COLUMN gannet_demo.equipos.es_alquilable IS
  'Indica si el equipo se ofrece en alquiler al cliente ademas de usarse internamente.';
COMMENT ON COLUMN gannet_demo.equipos.tarifa_dia_ars IS
  'Precio de alquiler por dia en pesos argentinos. Aplica solo a equipos alquilables.';
COMMENT ON COLUMN gannet_demo.equipos.valor_ars IS
  'Valor patrimonial estimado del equipo en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.equipos.deposito_id IS
  'Deposito donde el equipo se encuentra o tiene su base.';
COMMENT ON COLUMN gannet_demo.equipos.responsable_id IS
  'Empleado que tiene el equipo bajo su custodia.';
COMMENT ON COLUMN gannet_demo.equipos.proxima_calibracion IS
  'Fecha de la proxima calibracion obligatoria. Aplica sobre todo al instrumental de medicion y alimenta alertas de vencimiento.';
COMMENT ON COLUMN gannet_demo.equipos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 9. articulos — catalogo de materiales e insumos
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.articulos (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo               text NOT NULL UNIQUE,
  descripcion          text NOT NULL,
  categoria            text NOT NULL CHECK (categoria IN ('repuesto','consumible','epp','lubricante','combustible','ferreteria','electrico','quimico','papeleria')),
  unidad_medida        text NOT NULL CHECK (unidad_medida IN ('unidad','metro','litro','kg','caja','par','rollo','m3')),
  stock_minimo         numeric(14,2),
  costo_unitario_ars   numeric(14,2),
  activo               boolean NOT NULL DEFAULT true,
  creado_en            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.articulos IS
  'Catalogo maestro de materiales, repuestos e insumos que Andes compra y consume. Define QUE es cada item; las cantidades por deposito viven en la tabla stock.';
COMMENT ON COLUMN gannet_demo.articulos.codigo IS
  'Codigo de catalogo del articulo. Identificador de negocio unico.';
COMMENT ON COLUMN gannet_demo.articulos.descripcion IS
  'Denominacion del articulo.';
COMMENT ON COLUMN gannet_demo.articulos.categoria IS
  'Familia del articulo, usada para clasificar consumos y compras.';
COMMENT ON COLUMN gannet_demo.articulos.unidad_medida IS
  'Unidad en la que se cuenta, compra y consume el articulo.';
COMMENT ON COLUMN gannet_demo.articulos.stock_minimo IS
  'Cantidad por debajo de la cual el articulo se considera en punto de reposicion.';
COMMENT ON COLUMN gannet_demo.articulos.costo_unitario_ars IS
  'Costo de referencia por unidad en pesos argentinos, usado para valorizar el inventario.';
COMMENT ON COLUMN gannet_demo.articulos.activo IS
  'Indica si el articulo sigue vigente en el catalogo.';
COMMENT ON COLUMN gannet_demo.articulos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 10. stock — existencias por articulo y deposito
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.stock (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id     bigint NOT NULL REFERENCES gannet_demo.articulos(id),
  deposito_id     bigint NOT NULL REFERENCES gannet_demo.depositos(id),
  cantidad        numeric(14,2) NOT NULL DEFAULT 0,
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_articulo_deposito_key UNIQUE (articulo_id, deposito_id)
);

COMMENT ON TABLE gannet_demo.stock IS
  'Existencia actual de cada articulo en cada deposito. Es la foto del inventario; el historial de entradas y salidas vive en movimientos_stock.';
COMMENT ON COLUMN gannet_demo.stock.articulo_id IS
  'Articulo cuya existencia se registra.';
COMMENT ON COLUMN gannet_demo.stock.deposito_id IS
  'Deposito donde se encuentra la existencia.';
COMMENT ON COLUMN gannet_demo.stock.cantidad IS
  'Cantidad disponible, expresada en la unidad de medida del articulo.';
COMMENT ON COLUMN gannet_demo.stock.actualizado_en IS
  'Marca temporal del ultimo recuento o movimiento que modifico la cantidad.';
COMMENT ON COLUMN gannet_demo.stock.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 11. proyectos — contratos y obras vendidas al cliente
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.proyectos (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  codigo                text NOT NULL UNIQUE,
  nombre                text NOT NULL,
  cliente_id            bigint NOT NULL REFERENCES gannet_demo.clientes(id),
  faena_id              bigint REFERENCES gannet_demo.faenas(id),
  servicio_id           bigint NOT NULL REFERENCES gannet_demo.servicios(id),
  responsable_id        bigint REFERENCES gannet_demo.empleados(id),
  tipo_contrato         text NOT NULL CHECK (tipo_contrato IN ('por_obra','por_servicio','oc_abierta','llave_en_mano')),
  estado                text NOT NULL DEFAULT 'planificado' CHECK (estado IN ('planificado','en_curso','suspendido','finalizado','cancelado')),
  fecha_inicio_plan     date,
  fecha_fin_plan        date,
  fecha_inicio_real     date,
  fecha_fin_real        date,
  monto_contrato_ars    numeric(14,2),
  monto_ejecutado_ars   numeric(14,2),
  avance_pct            integer CHECK (avance_pct BETWEEN 0 AND 100),
  margen_objetivo_pct   numeric(5,2),
  creado_en             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proyectos_fechas_plan_check
    CHECK (fecha_fin_plan IS NULL OR fecha_inicio_plan IS NULL OR fecha_fin_plan >= fecha_inicio_plan)
);

COMMENT ON TABLE gannet_demo.proyectos IS
  'Contratos y obras que Andes ejecuta para un cliente. Agrupa las ordenes de trabajo, las compras y la facturacion de un mismo compromiso comercial.';
COMMENT ON COLUMN gannet_demo.proyectos.codigo IS
  'Codigo de proyecto. Identificador de negocio unico usado en toda la documentacion.';
COMMENT ON COLUMN gannet_demo.proyectos.cliente_id IS
  'Cliente que contrata el proyecto.';
COMMENT ON COLUMN gannet_demo.proyectos.faena_id IS
  'Faena del cliente donde se ejecuta el proyecto. Nulo si abarca varias.';
COMMENT ON COLUMN gannet_demo.proyectos.servicio_id IS
  'Servicio principal que el proyecto entrega.';
COMMENT ON COLUMN gannet_demo.proyectos.responsable_id IS
  'Empleado a cargo de la conduccion del proyecto.';
COMMENT ON COLUMN gannet_demo.proyectos.tipo_contrato IS
  'Modalidad contractual: por obra, por servicio continuo, orden de compra abierta o llave en mano.';
COMMENT ON COLUMN gannet_demo.proyectos.estado IS
  'Situacion del proyecto: planificado, en curso, suspendido, finalizado o cancelado.';
COMMENT ON COLUMN gannet_demo.proyectos.fecha_inicio_plan IS
  'Fecha de inicio comprometida en el plan.';
COMMENT ON COLUMN gannet_demo.proyectos.fecha_fin_plan IS
  'Fecha de finalizacion comprometida en el plan. Comparada con la real da el desvio de plazo.';
COMMENT ON COLUMN gannet_demo.proyectos.fecha_inicio_real IS
  'Fecha en que el proyecto efectivamente comenzo.';
COMMENT ON COLUMN gannet_demo.proyectos.fecha_fin_real IS
  'Fecha en que el proyecto efectivamente termino. Nulo mientras siga abierto.';
COMMENT ON COLUMN gannet_demo.proyectos.monto_contrato_ars IS
  'Monto total contratado en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.proyectos.monto_ejecutado_ars IS
  'Monto ya ejecutado en pesos argentinos. Comparado con el contratado da el avance economico.';
COMMENT ON COLUMN gannet_demo.proyectos.avance_pct IS
  'Avance fisico del proyecto entre 0 y 100 por ciento.';
COMMENT ON COLUMN gannet_demo.proyectos.margen_objetivo_pct IS
  'Margen de rentabilidad objetivo en porcentaje, fijado al cotizar.';
COMMENT ON COLUMN gannet_demo.proyectos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 12. ordenes_trabajo — unidad operativa de ejecucion
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.ordenes_trabajo (
  id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero                  text NOT NULL UNIQUE,
  cliente_id              bigint NOT NULL REFERENCES gannet_demo.clientes(id),
  proyecto_id             bigint REFERENCES gannet_demo.proyectos(id),
  faena_id                bigint REFERENCES gannet_demo.faenas(id),
  servicio_id             bigint NOT NULL REFERENCES gannet_demo.servicios(id),
  responsable_id          bigint NOT NULL REFERENCES gannet_demo.empleados(id),
  vehiculo_id             bigint REFERENCES gannet_demo.vehiculos(id),
  equipo_id               bigint REFERENCES gannet_demo.equipos(id),
  titulo                  text NOT NULL,
  descripcion             text,
  tipo                    text NOT NULL CHECK (tipo IN ('preventivo','correctivo','emergencia','programado','instalacion','inspeccion')),
  prioridad               text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta','critica')),
  estado                  text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','programada','en_ejecucion','pausada','completada','cancelada')),
  fecha_programada        date,
  fecha_inicio            timestamptz,
  fecha_fin               timestamptz,
  horas_estimadas         numeric(8,2),
  horas_reales            numeric(8,2),
  costo_mano_obra_ars     numeric(14,2),
  costo_materiales_ars    numeric(14,2),
  monto_facturable_ars    numeric(14,2),
  requiere_permiso        boolean NOT NULL DEFAULT false,
  incidentes_seguridad    integer NOT NULL DEFAULT 0,
  creado_en               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ordenes_trabajo_fechas_check
    CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

COMMENT ON TABLE gannet_demo.ordenes_trabajo IS
  'Orden de trabajo (OT): la unidad operativa con la que Andes ejecuta y factura tareas concretas para un cliente. Es la tabla de mayor volumen y el centro del panel operativo.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.numero IS
  'Numero de orden de trabajo. Identificador de negocio unico.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.cliente_id IS
  'Cliente para el que se ejecuta el trabajo.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.proyecto_id IS
  'Proyecto al que se imputa la orden. Nulo en trabajos sueltos fuera de contrato.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.faena_id IS
  'Faena del cliente donde se ejecuta el trabajo.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.servicio_id IS
  'Servicio bajo el cual se clasifica el trabajo.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.responsable_id IS
  'Empleado responsable de la ejecucion de la orden.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.vehiculo_id IS
  'Vehiculo afectado al trabajo, si corresponde.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.equipo_id IS
  'Equipo principal afectado al trabajo, si corresponde.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.titulo IS
  'Resumen breve del trabajo a realizar.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.descripcion IS
  'Detalle del alcance, condiciones y observaciones del trabajo.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.tipo IS
  'Naturaleza del trabajo: preventivo, correctivo, emergencia, programado, instalacion o inspeccion.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.prioridad IS
  'Urgencia asignada a la orden: baja, media, alta o critica.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.estado IS
  'Etapa del ciclo de vida de la orden: borrador, programada, en ejecucion, pausada, completada o cancelada.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.fecha_programada IS
  'Fecha para la que el trabajo fue agendado.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.fecha_inicio IS
  'Momento en que el trabajo efectivamente comenzo.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.fecha_fin IS
  'Momento en que el trabajo efectivamente termino. Nunca anterior al inicio.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.horas_estimadas IS
  'Horas de trabajo previstas al planificar la orden.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.horas_reales IS
  'Horas de trabajo efectivamente insumidas. Comparadas con las estimadas dan el desvio de esfuerzo.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.costo_mano_obra_ars IS
  'Costo de mano de obra imputado a la orden en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.costo_materiales_ars IS
  'Costo de materiales consumidos por la orden en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.monto_facturable_ars IS
  'Monto que se factura al cliente por esta orden en pesos argentinos. Restado de los costos da el margen de la orden.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.requiere_permiso IS
  'Indica si el trabajo exige permiso de trabajo previo del cliente, habitual en tareas de riesgo dentro de faena.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.incidentes_seguridad IS
  'Cantidad de incidentes de seguridad registrados durante la ejecucion. Cero es el valor esperado.';
COMMENT ON COLUMN gannet_demo.ordenes_trabajo.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 13. ot_asignaciones — cuadrilla asignada a cada orden de trabajo
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.ot_asignaciones (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_trabajo_id   bigint NOT NULL REFERENCES gannet_demo.ordenes_trabajo(id),
  empleado_id        bigint NOT NULL REFERENCES gannet_demo.empleados(id),
  rol_en_ot          text NOT NULL CHECK (rol_en_ot IN ('supervisor','tecnico','operario','chofer','ayudante','seguridad')),
  horas              numeric(8,2),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ot_asignaciones_ot_empleado_key UNIQUE (orden_trabajo_id, empleado_id)
);

COMMENT ON TABLE gannet_demo.ot_asignaciones IS
  'Vinculo entre ordenes de trabajo y empleados: la cuadrilla asignada a cada trabajo y el rol de cada integrante. Un empleado figura una sola vez por orden.';
COMMENT ON COLUMN gannet_demo.ot_asignaciones.orden_trabajo_id IS
  'Orden de trabajo a la que se asigna el empleado.';
COMMENT ON COLUMN gannet_demo.ot_asignaciones.empleado_id IS
  'Empleado asignado a la orden.';
COMMENT ON COLUMN gannet_demo.ot_asignaciones.rol_en_ot IS
  'Funcion que cumple el empleado dentro de esta orden concreta, que puede diferir de su puesto habitual.';
COMMENT ON COLUMN gannet_demo.ot_asignaciones.horas IS
  'Horas aportadas por este empleado a la orden.';
COMMENT ON COLUMN gannet_demo.ot_asignaciones.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 14. turnos — parte diario de asistencia del personal
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.turnos (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empleado_id        bigint NOT NULL REFERENCES gannet_demo.empleados(id),
  faena_id           bigint REFERENCES gannet_demo.faenas(id),
  orden_trabajo_id   bigint REFERENCES gannet_demo.ordenes_trabajo(id),
  fecha              date NOT NULL,
  turno              text NOT NULL CHECK (turno IN ('mañana','tarde','noche')),
  horas              numeric(4,1) CHECK (horas >= 0 AND horas <= 24),
  estado             text NOT NULL DEFAULT 'presente' CHECK (estado IN ('presente','ausente','licencia','franco','accidente')),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT turnos_empleado_fecha_turno_key UNIQUE (empleado_id, fecha, turno)
);

COMMENT ON TABLE gannet_demo.turnos IS
  'Parte diario de asistencia: un registro por empleado, fecha y turno. Base del modulo de recursos humanos y del calculo de horas trabajadas.';
COMMENT ON COLUMN gannet_demo.turnos.empleado_id IS
  'Empleado al que corresponde el registro de asistencia.';
COMMENT ON COLUMN gannet_demo.turnos.faena_id IS
  'Faena donde el empleado cumplio el turno. Nulo si trabajo en base propia.';
COMMENT ON COLUMN gannet_demo.turnos.orden_trabajo_id IS
  'Orden de trabajo a la que se imputa el turno, cuando el empleado dedico la jornada a un trabajo concreto.';
COMMENT ON COLUMN gannet_demo.turnos.fecha IS
  'Fecha del turno.';
COMMENT ON COLUMN gannet_demo.turnos.turno IS
  'Franja horaria cubierta: mañana, tarde o noche.';
COMMENT ON COLUMN gannet_demo.turnos.horas IS
  'Horas efectivamente trabajadas en el turno, entre 0 y 24.';
COMMENT ON COLUMN gannet_demo.turnos.estado IS
  'Condicion de la jornada: presente, ausente, con licencia, de franco o con accidente.';
COMMENT ON COLUMN gannet_demo.turnos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 15. cotizaciones — propuestas comerciales
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.cotizaciones (
  id                        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero                    text NOT NULL UNIQUE,
  cliente_id                bigint NOT NULL REFERENCES gannet_demo.clientes(id),
  contacto_id               bigint REFERENCES gannet_demo.contactos(id),
  proyecto_id               bigint REFERENCES gannet_demo.proyectos(id),
  servicio_principal_id     bigint NOT NULL REFERENCES gannet_demo.servicios(id),
  responsable_comercial_id  bigint REFERENCES gannet_demo.empleados(id),
  estado                    text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','enviada','en_negociacion','aceptada','rechazada','vencida')),
  fecha_emision             date,
  fecha_validez             date,
  subtotal_ars              numeric(14,2),
  descuento_pct             numeric(5,2),
  impuestos_ars             numeric(14,2),
  total_ars                 numeric(14,2),
  probabilidad_pct          integer CHECK (probabilidad_pct BETWEEN 0 AND 100),
  motivo_rechazo            text,
  creado_en                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cotizaciones_fechas_check
    CHECK (fecha_validez IS NULL OR fecha_emision IS NULL OR fecha_validez >= fecha_emision)
);

COMMENT ON TABLE gannet_demo.cotizaciones IS
  'Propuestas economicas presentadas a los clientes. Constituyen el embudo comercial: una cotizacion aceptada da origen a un proyecto o a ordenes de trabajo.';
COMMENT ON COLUMN gannet_demo.cotizaciones.numero IS
  'Numero de cotizacion. Identificador de negocio unico.';
COMMENT ON COLUMN gannet_demo.cotizaciones.cliente_id IS
  'Cliente al que se dirige la propuesta.';
COMMENT ON COLUMN gannet_demo.cotizaciones.contacto_id IS
  'Persona del cliente que recibe la propuesta.';
COMMENT ON COLUMN gannet_demo.cotizaciones.proyecto_id IS
  'Proyecto originado por la cotizacion, o al que la cotizacion amplia. Nulo mientras no se haya concretado.';
COMMENT ON COLUMN gannet_demo.cotizaciones.servicio_principal_id IS
  'Servicio predominante de la propuesta, usado para clasificar el embudo por linea de negocio.';
COMMENT ON COLUMN gannet_demo.cotizaciones.responsable_comercial_id IS
  'Empleado del area comercial que elabora y sigue la propuesta.';
COMMENT ON COLUMN gannet_demo.cotizaciones.estado IS
  'Etapa comercial: borrador, enviada, en negociacion, aceptada, rechazada o vencida por caducidad.';
COMMENT ON COLUMN gannet_demo.cotizaciones.fecha_emision IS
  'Fecha en que la propuesta fue emitida al cliente.';
COMMENT ON COLUMN gannet_demo.cotizaciones.fecha_validez IS
  'Fecha hasta la que el precio ofrecido se mantiene vigente. Nunca anterior a la emision.';
COMMENT ON COLUMN gannet_demo.cotizaciones.subtotal_ars IS
  'Suma de los items antes de descuentos e impuestos, en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.cotizaciones.descuento_pct IS
  'Descuento comercial aplicado sobre el subtotal, en porcentaje.';
COMMENT ON COLUMN gannet_demo.cotizaciones.impuestos_ars IS
  'Impuestos incluidos en la propuesta, en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.cotizaciones.total_ars IS
  'Importe final ofertado al cliente en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.cotizaciones.probabilidad_pct IS
  'Probabilidad estimada de cierre entre 0 y 100 por ciento. Pondera el embudo comercial.';
COMMENT ON COLUMN gannet_demo.cotizaciones.motivo_rechazo IS
  'Razon informada por el cliente cuando la propuesta se rechaza.';
COMMENT ON COLUMN gannet_demo.cotizaciones.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 16. cotizacion_items — detalle de cada propuesta
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.cotizacion_items (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cotizacion_id          bigint NOT NULL REFERENCES gannet_demo.cotizaciones(id),
  servicio_id            bigint NOT NULL REFERENCES gannet_demo.servicios(id),
  descripcion            text,
  cantidad               numeric(14,2) NOT NULL CHECK (cantidad > 0),
  unidad                 text,
  precio_unitario_ars    numeric(14,2),
  total_ars              numeric(14,2),
  orden                  integer,
  creado_en              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.cotizacion_items IS
  'Renglones que componen una cotizacion. Cada item cotiza un servicio con su cantidad y precio unitario.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.cotizacion_id IS
  'Cotizacion a la que pertenece el renglon.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.servicio_id IS
  'Servicio cotizado en este renglon.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.descripcion IS
  'Detalle del alcance cotizado en este renglon.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.cantidad IS
  'Cantidad cotizada, siempre mayor que cero.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.unidad IS
  'Unidad en la que se expresa la cantidad. Suele coincidir con la unidad de facturacion del servicio.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.precio_unitario_ars IS
  'Precio por unidad ofertado en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.total_ars IS
  'Importe del renglon en pesos argentinos, resultado de cantidad por precio unitario.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.orden IS
  'Posicion del renglon dentro de la cotizacion, para preservar el orden de presentacion.';
COMMENT ON COLUMN gannet_demo.cotizacion_items.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 17. facturas — comprobantes emitidos al cliente
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.facturas (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero               text NOT NULL UNIQUE,
  tipo_comprobante     text NOT NULL CHECK (tipo_comprobante IN ('factura_a','factura_b','factura_c','nota_credito','nota_debito')),
  cliente_id           bigint NOT NULL REFERENCES gannet_demo.clientes(id),
  proyecto_id          bigint REFERENCES gannet_demo.proyectos(id),
  orden_trabajo_id     bigint REFERENCES gannet_demo.ordenes_trabajo(id),
  cotizacion_id        bigint REFERENCES gannet_demo.cotizaciones(id),
  estado               text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','emitida','enviada','cobrada','vencida','anulada')),
  fecha_emision        date,
  fecha_vencimiento    date,
  fecha_cobro          date,
  neto_ars             numeric(14,2),
  iva_ars              numeric(14,2),
  total_ars            numeric(14,2),
  creado_en            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturas_vencimiento_check
    CHECK (fecha_vencimiento IS NULL OR fecha_emision IS NULL OR fecha_vencimiento >= fecha_emision),
  CONSTRAINT facturas_cobro_check
    CHECK (fecha_cobro IS NULL OR fecha_emision IS NULL OR fecha_cobro >= fecha_emision),
  CONSTRAINT facturas_estado_cobro_check
    CHECK ((estado = 'cobrada') = (fecha_cobro IS NOT NULL))
);

COMMENT ON TABLE gannet_demo.facturas IS
  'Comprobantes emitidos por Andes a sus clientes. Sostiene el modulo de facturacion y el analisis de cobranzas y morosidad.';
COMMENT ON COLUMN gannet_demo.facturas.numero IS
  'Numero de comprobante. Identificador de negocio unico.';
COMMENT ON COLUMN gannet_demo.facturas.tipo_comprobante IS
  'Tipo fiscal del comprobante segun la normativa argentina: factura A, B o C, nota de credito o nota de debito.';
COMMENT ON COLUMN gannet_demo.facturas.cliente_id IS
  'Cliente al que se emite el comprobante.';
COMMENT ON COLUMN gannet_demo.facturas.proyecto_id IS
  'Proyecto al que se imputa la facturacion.';
COMMENT ON COLUMN gannet_demo.facturas.orden_trabajo_id IS
  'Orden de trabajo que origina la facturacion, cuando se factura trabajo suelto.';
COMMENT ON COLUMN gannet_demo.facturas.cotizacion_id IS
  'Cotizacion que dio origen al comprobante.';
COMMENT ON COLUMN gannet_demo.facturas.estado IS
  'Situacion del comprobante: borrador, emitida, enviada, cobrada, vencida o anulada. El estado cobrada exige fecha de cobro, y viceversa.';
COMMENT ON COLUMN gannet_demo.facturas.fecha_emision IS
  'Fecha de emision del comprobante.';
COMMENT ON COLUMN gannet_demo.facturas.fecha_vencimiento IS
  'Fecha limite de pago segun la condicion acordada con el cliente. Nunca anterior a la emision.';
COMMENT ON COLUMN gannet_demo.facturas.fecha_cobro IS
  'Fecha en que el comprobante fue efectivamente cobrado. Nula mientras siga pendiente.';
COMMENT ON COLUMN gannet_demo.facturas.neto_ars IS
  'Importe neto gravado en pesos argentinos, sin impuestos.';
COMMENT ON COLUMN gannet_demo.facturas.iva_ars IS
  'Impuesto al valor agregado del comprobante en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.facturas.total_ars IS
  'Importe total del comprobante en pesos argentinos, neto mas impuestos.';
COMMENT ON COLUMN gannet_demo.facturas.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 18. proveedores — proveedores DE Andes
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.proveedores (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  razon_social          text NOT NULL,
  cuit                  text NOT NULL UNIQUE,
  rubro                 text NOT NULL CHECK (rubro IN ('materiales','repuestos','combustible','subcontrato','servicios','logistica','epp','alquileres')),
  contacto              text,
  email                 text,
  telefono              text,
  condicion_pago_dias   integer,
  calificacion          integer CHECK (calificacion BETWEEN 1 AND 5),
  activo                boolean NOT NULL DEFAULT true,
  creado_en             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.proveedores IS
  'Proveedores DE Andes Servicios Integrales: quienes le venden materiales, repuestos, combustible, servicios subcontratados y alquileres. IMPORTANTE: no confundir con demo_mineria.proveedores, tabla del esquema legado donde los proveedores eran los observados por una empresa minera. Aqui Andes es el comprador.';
COMMENT ON COLUMN gannet_demo.proveedores.razon_social IS
  'Denominacion legal del proveedor.';
COMMENT ON COLUMN gannet_demo.proveedores.cuit IS
  'Clave Unica de Identificacion Tributaria del proveedor. Identificador fiscal unico.';
COMMENT ON COLUMN gannet_demo.proveedores.rubro IS
  'Tipo de bien o servicio que el proveedor abastece a Andes.';
COMMENT ON COLUMN gannet_demo.proveedores.contacto IS
  'Nombre de la persona de contacto en el proveedor.';
COMMENT ON COLUMN gannet_demo.proveedores.condicion_pago_dias IS
  'Plazo de pago que el proveedor concede a Andes, en dias corridos.';
COMMENT ON COLUMN gannet_demo.proveedores.calificacion IS
  'Evaluacion de desempeno del proveedor en una escala de 1 a 5, donde 5 es el mejor.';
COMMENT ON COLUMN gannet_demo.proveedores.activo IS
  'Indica si se sigue comprando a este proveedor.';
COMMENT ON COLUMN gannet_demo.proveedores.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 19. ordenes_compra — compras de Andes a sus proveedores
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.ordenes_compra (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero                   text NOT NULL UNIQUE,
  proveedor_id             bigint NOT NULL REFERENCES gannet_demo.proveedores(id),
  proyecto_id              bigint REFERENCES gannet_demo.proyectos(id),
  orden_trabajo_id         bigint REFERENCES gannet_demo.ordenes_trabajo(id),
  solicitante_id           bigint REFERENCES gannet_demo.empleados(id),
  deposito_destino_id      bigint REFERENCES gannet_demo.depositos(id),
  estado                   text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','aprobada','enviada','recibida_parcial','recibida','cancelada')),
  fecha_emision            date,
  fecha_entrega_estimada   date,
  fecha_recepcion          date,
  total_ars                numeric(14,2),
  creado_en                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.ordenes_compra IS
  'Ordenes de compra que Andes emite a sus proveedores. Sostiene el modulo de compras y conecta el abastecimiento con proyectos, ordenes de trabajo y depositos.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.numero IS
  'Numero de orden de compra. Identificador de negocio unico.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.proveedor_id IS
  'Proveedor al que se emite la orden.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.proyecto_id IS
  'Proyecto al que se imputa la compra.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.orden_trabajo_id IS
  'Orden de trabajo que motiva la compra, cuando el abastecimiento responde a un trabajo puntual.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.solicitante_id IS
  'Empleado que origina el pedido de compra.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.deposito_destino_id IS
  'Deposito donde se recibe la mercaderia.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.estado IS
  'Etapa de la compra: borrador, aprobada, enviada al proveedor, recibida parcialmente, recibida por completo o cancelada.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.fecha_emision IS
  'Fecha de emision de la orden al proveedor.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.fecha_entrega_estimada IS
  'Fecha de entrega comprometida por el proveedor. Comparada con la recepcion mide su cumplimiento.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.fecha_recepcion IS
  'Fecha en que la mercaderia fue efectivamente recibida.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.total_ars IS
  'Importe total de la orden de compra en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.ordenes_compra.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 20. orden_compra_items — detalle de cada orden de compra
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.orden_compra_items (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  orden_compra_id       bigint NOT NULL REFERENCES gannet_demo.ordenes_compra(id),
  articulo_id           bigint REFERENCES gannet_demo.articulos(id),
  descripcion           text,
  cantidad              numeric(14,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario_ars   numeric(14,2),
  total_ars             numeric(14,2),
  creado_en             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.orden_compra_items IS
  'Renglones que componen una orden de compra. Un renglon puede referir a un articulo del catalogo o describir un bien o servicio no catalogado.';
COMMENT ON COLUMN gannet_demo.orden_compra_items.orden_compra_id IS
  'Orden de compra a la que pertenece el renglon.';
COMMENT ON COLUMN gannet_demo.orden_compra_items.articulo_id IS
  'Articulo del catalogo que se compra. Nulo cuando se adquiere algo no catalogado, como un servicio subcontratado.';
COMMENT ON COLUMN gannet_demo.orden_compra_items.descripcion IS
  'Detalle de lo comprado. Obligatorio en la practica cuando no hay articulo asociado.';
COMMENT ON COLUMN gannet_demo.orden_compra_items.cantidad IS
  'Cantidad solicitada, siempre mayor que cero.';
COMMENT ON COLUMN gannet_demo.orden_compra_items.precio_unitario_ars IS
  'Precio por unidad acordado con el proveedor en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.orden_compra_items.total_ars IS
  'Importe del renglon en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.orden_compra_items.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 21. movimientos_stock — historial de entradas y salidas de inventario
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.movimientos_stock (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  articulo_id         bigint NOT NULL REFERENCES gannet_demo.articulos(id),
  deposito_id         bigint NOT NULL REFERENCES gannet_demo.depositos(id),
  tipo                text NOT NULL CHECK (tipo IN ('ingreso','egreso','transferencia','ajuste','devolucion')),
  cantidad            numeric(14,2) NOT NULL CHECK (cantidad <> 0),
  orden_trabajo_id    bigint REFERENCES gannet_demo.ordenes_trabajo(id),
  orden_compra_id     bigint REFERENCES gannet_demo.ordenes_compra(id),
  empleado_id         bigint REFERENCES gannet_demo.empleados(id),
  fecha               timestamptz NOT NULL DEFAULT now(),
  observacion         text,
  creado_en           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE gannet_demo.movimientos_stock IS
  'Historial de todos los movimientos de inventario. Explica COMO se llego a la existencia actual registrada en la tabla stock, y permite rastrear el consumo de materiales por orden de trabajo.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.articulo_id IS
  'Articulo movido.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.deposito_id IS
  'Deposito afectado por el movimiento.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.tipo IS
  'Naturaleza del movimiento: ingreso, egreso, transferencia entre depositos, ajuste de inventario o devolucion.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.cantidad IS
  'Cantidad movida, expresada con signo: positiva si suma existencia y negativa si la resta. Nunca cero.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.orden_trabajo_id IS
  'Orden de trabajo que consume el material, en los egresos por consumo.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.orden_compra_id IS
  'Orden de compra que origina el material, en los ingresos por recepcion.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.empleado_id IS
  'Empleado que registra o ejecuta el movimiento.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.fecha IS
  'Momento en que se produjo el movimiento.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.observacion IS
  'Nota libre que justifica o aclara el movimiento.';
COMMENT ON COLUMN gannet_demo.movimientos_stock.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 22. mantenimientos — intervenciones sobre vehiculos y equipos
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.mantenimientos (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vehiculo_id      bigint REFERENCES gannet_demo.vehiculos(id),
  equipo_id        bigint REFERENCES gannet_demo.equipos(id),
  proveedor_id     bigint REFERENCES gannet_demo.proveedores(id),
  responsable_id   bigint REFERENCES gannet_demo.empleados(id),
  tipo             text NOT NULL CHECK (tipo IN ('preventivo','correctivo','calibracion','vtv','service')),
  estado           text NOT NULL DEFAULT 'programado' CHECK (estado IN ('programado','en_taller','completado','cancelado')),
  fecha            date,
  fecha_fin        date,
  km_odometro      integer,
  costo_ars        numeric(14,2),
  descripcion      text,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mantenimientos_activo_unico_check
    CHECK (num_nonnulls(vehiculo_id, equipo_id) = 1)
);

COMMENT ON TABLE gannet_demo.mantenimientos IS
  'Intervenciones de mantenimiento sobre los activos propios de Andes. Cada registro refiere a un vehiculo o a un equipo, nunca a ambos ni a ninguno.';
COMMENT ON COLUMN gannet_demo.mantenimientos.vehiculo_id IS
  'Vehiculo intervenido. Excluyente con equipo_id.';
COMMENT ON COLUMN gannet_demo.mantenimientos.equipo_id IS
  'Equipo intervenido. Excluyente con vehiculo_id.';
COMMENT ON COLUMN gannet_demo.mantenimientos.proveedor_id IS
  'Taller o proveedor externo que ejecuta la intervencion. Nulo cuando se resuelve con personal propio.';
COMMENT ON COLUMN gannet_demo.mantenimientos.responsable_id IS
  'Empleado que gestiona la intervencion.';
COMMENT ON COLUMN gannet_demo.mantenimientos.tipo IS
  'Naturaleza de la intervencion: preventivo, correctivo, calibracion de instrumental, verificacion tecnica vehicular o service de rutina.';
COMMENT ON COLUMN gannet_demo.mantenimientos.estado IS
  'Situacion de la intervencion: programado, en taller, completado o cancelado.';
COMMENT ON COLUMN gannet_demo.mantenimientos.fecha IS
  'Fecha de inicio o de programacion de la intervencion.';
COMMENT ON COLUMN gannet_demo.mantenimientos.fecha_fin IS
  'Fecha de finalizacion de la intervencion. Nula mientras el activo siga en taller.';
COMMENT ON COLUMN gannet_demo.mantenimientos.km_odometro IS
  'Lectura del odometro al momento de la intervencion. Aplica a vehiculos.';
COMMENT ON COLUMN gannet_demo.mantenimientos.costo_ars IS
  'Costo de la intervencion en pesos argentinos.';
COMMENT ON COLUMN gannet_demo.mantenimientos.descripcion IS
  'Detalle de las tareas realizadas o de la falla atendida.';
COMMENT ON COLUMN gannet_demo.mantenimientos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 23. actividades — bitacora transversal de gestion
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.actividades (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo                text NOT NULL CHECK (tipo IN ('llamada','reunion','visita','email','nota','hito','alerta','cambio_estado','tarea')),
  titulo              text NOT NULL,
  descripcion         text,
  cliente_id          bigint REFERENCES gannet_demo.clientes(id),
  contacto_id         bigint REFERENCES gannet_demo.contactos(id),
  proyecto_id         bigint REFERENCES gannet_demo.proyectos(id),
  orden_trabajo_id    bigint REFERENCES gannet_demo.ordenes_trabajo(id),
  cotizacion_id       bigint REFERENCES gannet_demo.cotizaciones(id),
  autor_id            bigint REFERENCES gannet_demo.empleados(id),
  fecha               timestamptz NOT NULL DEFAULT now(),
  estado              text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_curso','completada','cancelada')),
  creado_en           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT actividades_vinculo_check
    CHECK (num_nonnulls(cliente_id, proyecto_id, orden_trabajo_id, cotizacion_id) >= 1)
);

COMMENT ON TABLE gannet_demo.actividades IS
  'Bitacora transversal de gestion: llamadas, reuniones, visitas, hitos, alertas y tareas. Alimenta la linea de tiempo del sistema. Toda actividad esta vinculada al menos a un cliente, proyecto, orden de trabajo o cotizacion.';
COMMENT ON COLUMN gannet_demo.actividades.tipo IS
  'Naturaleza del registro: llamada, reunion, visita, email, nota, hito, alerta, cambio de estado o tarea.';
COMMENT ON COLUMN gannet_demo.actividades.titulo IS
  'Resumen breve de la actividad, el texto que se muestra en la linea de tiempo.';
COMMENT ON COLUMN gannet_demo.actividades.descripcion IS
  'Detalle o minuta de la actividad.';
COMMENT ON COLUMN gannet_demo.actividades.cliente_id IS
  'Cliente al que refiere la actividad.';
COMMENT ON COLUMN gannet_demo.actividades.contacto_id IS
  'Persona del cliente involucrada en la actividad.';
COMMENT ON COLUMN gannet_demo.actividades.proyecto_id IS
  'Proyecto al que refiere la actividad.';
COMMENT ON COLUMN gannet_demo.actividades.orden_trabajo_id IS
  'Orden de trabajo a la que refiere la actividad.';
COMMENT ON COLUMN gannet_demo.actividades.cotizacion_id IS
  'Cotizacion a la que refiere la actividad.';
COMMENT ON COLUMN gannet_demo.actividades.autor_id IS
  'Empleado que registra la actividad.';
COMMENT ON COLUMN gannet_demo.actividades.fecha IS
  'Momento en que la actividad ocurrio o esta prevista.';
COMMENT ON COLUMN gannet_demo.actividades.estado IS
  'Situacion de la actividad: pendiente, en curso, completada o cancelada.';
COMMENT ON COLUMN gannet_demo.actividades.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- 24. documentos — archivos asociados a entidades del sistema
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.documentos (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre              text NOT NULL,
  tipo                text NOT NULL CHECK (tipo IN ('contrato','certificado','plano','informe','remito','procedimiento','habilitacion','poliza','foto','factura_pdf','manual')),
  cliente_id          bigint REFERENCES gannet_demo.clientes(id),
  proyecto_id         bigint REFERENCES gannet_demo.proyectos(id),
  orden_trabajo_id    bigint REFERENCES gannet_demo.ordenes_trabajo(id),
  empleado_id         bigint REFERENCES gannet_demo.empleados(id),
  vehiculo_id         bigint REFERENCES gannet_demo.vehiculos(id),
  equipo_id           bigint REFERENCES gannet_demo.equipos(id),
  fecha_emision       date,
  fecha_vencimiento   date,
  url_archivo         text,
  tamano_kb           integer,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documentos_vinculo_check
    CHECK (num_nonnulls(cliente_id, proyecto_id, orden_trabajo_id, empleado_id, vehiculo_id, equipo_id) >= 1)
);

COMMENT ON TABLE gannet_demo.documentos IS
  'Repositorio documental del sistema: contratos, certificados, planos, informes, habilitaciones y polizas. Todo documento cuelga de al menos una entidad del negocio.';
COMMENT ON COLUMN gannet_demo.documentos.nombre IS
  'Titulo del documento tal como se muestra al usuario.';
COMMENT ON COLUMN gannet_demo.documentos.tipo IS
  'Clase de documento, que determina su tratamiento y sus alertas de vencimiento.';
COMMENT ON COLUMN gannet_demo.documentos.cliente_id IS
  'Cliente al que pertenece el documento.';
COMMENT ON COLUMN gannet_demo.documentos.proyecto_id IS
  'Proyecto al que pertenece el documento.';
COMMENT ON COLUMN gannet_demo.documentos.orden_trabajo_id IS
  'Orden de trabajo a la que pertenece el documento, por ejemplo un remito o una foto de la tarea.';
COMMENT ON COLUMN gannet_demo.documentos.empleado_id IS
  'Empleado al que pertenece el documento, por ejemplo un certificado de capacitacion.';
COMMENT ON COLUMN gannet_demo.documentos.vehiculo_id IS
  'Vehiculo al que pertenece el documento, por ejemplo una poliza o una verificacion tecnica.';
COMMENT ON COLUMN gannet_demo.documentos.equipo_id IS
  'Equipo al que pertenece el documento, por ejemplo un certificado de calibracion o un manual.';
COMMENT ON COLUMN gannet_demo.documentos.fecha_emision IS
  'Fecha de emision del documento.';
COMMENT ON COLUMN gannet_demo.documentos.fecha_vencimiento IS
  'Fecha de caducidad del documento. Alimenta las alertas de documentacion por vencer.';
COMMENT ON COLUMN gannet_demo.documentos.url_archivo IS
  'Ubicacion del archivo en el almacenamiento de objetos.';
COMMENT ON COLUMN gannet_demo.documentos.tamano_kb IS
  'Tamano del archivo en kilobytes.';
COMMENT ON COLUMN gannet_demo.documentos.creado_en IS
  'Marca temporal de alta del registro.';

-- =============================================================================
-- INDICES
-- Cubren las claves foraneas que se usan como filtro y las combinaciones de
-- estado y fecha sobre las que se apoyan el panel ejecutivo y los listados.
-- =============================================================================

-- empleados
CREATE INDEX IF NOT EXISTS empleados_especialidad_idx     ON gannet_demo.empleados (especialidad_servicio_id);
CREATE INDEX IF NOT EXISTS empleados_supervisor_idx       ON gannet_demo.empleados (supervisor_id);
CREATE INDEX IF NOT EXISTS empleados_estado_area_idx      ON gannet_demo.empleados (estado, area);

-- clientes
CREATE INDEX IF NOT EXISTS clientes_ejecutivo_idx         ON gannet_demo.clientes (ejecutivo_cuenta_id);
CREATE INDEX IF NOT EXISTS clientes_estado_idx            ON gannet_demo.clientes (estado);
CREATE INDEX IF NOT EXISTS clientes_mineral_idx           ON gannet_demo.clientes (mineral_principal);

-- faenas
CREATE INDEX IF NOT EXISTS faenas_cliente_idx             ON gannet_demo.faenas (cliente_id);
CREATE INDEX IF NOT EXISTS faenas_tipo_activa_idx         ON gannet_demo.faenas (tipo, activa);

-- contactos
CREATE INDEX IF NOT EXISTS contactos_cliente_idx          ON gannet_demo.contactos (cliente_id);
CREATE INDEX IF NOT EXISTS contactos_faena_idx            ON gannet_demo.contactos (faena_id);

-- depositos
CREATE INDEX IF NOT EXISTS depositos_faena_idx            ON gannet_demo.depositos (faena_id);
CREATE INDEX IF NOT EXISTS depositos_responsable_idx      ON gannet_demo.depositos (responsable_id);

-- vehiculos
CREATE INDEX IF NOT EXISTS vehiculos_estado_tipo_idx      ON gannet_demo.vehiculos (estado, tipo);
CREATE INDEX IF NOT EXISTS vehiculos_responsable_idx      ON gannet_demo.vehiculos (responsable_id);
CREATE INDEX IF NOT EXISTS vehiculos_deposito_base_idx    ON gannet_demo.vehiculos (deposito_base_id);
CREATE INDEX IF NOT EXISTS vehiculos_vtv_vence_idx        ON gannet_demo.vehiculos (vtv_vence_el);
CREATE INDEX IF NOT EXISTS vehiculos_seguro_vence_idx     ON gannet_demo.vehiculos (seguro_vence_el);

-- equipos
CREATE INDEX IF NOT EXISTS equipos_estado_categoria_idx   ON gannet_demo.equipos (estado, categoria);
CREATE INDEX IF NOT EXISTS equipos_servicio_idx           ON gannet_demo.equipos (servicio_id);
CREATE INDEX IF NOT EXISTS equipos_deposito_idx           ON gannet_demo.equipos (deposito_id);
CREATE INDEX IF NOT EXISTS equipos_responsable_idx        ON gannet_demo.equipos (responsable_id);
CREATE INDEX IF NOT EXISTS equipos_proxima_calib_idx      ON gannet_demo.equipos (proxima_calibracion);

-- articulos y stock
CREATE INDEX IF NOT EXISTS articulos_categoria_idx        ON gannet_demo.articulos (categoria);
CREATE INDEX IF NOT EXISTS stock_deposito_idx             ON gannet_demo.stock (deposito_id);
CREATE INDEX IF NOT EXISTS stock_articulo_idx             ON gannet_demo.stock (articulo_id);

-- proyectos
CREATE INDEX IF NOT EXISTS proyectos_cliente_idx          ON gannet_demo.proyectos (cliente_id);
CREATE INDEX IF NOT EXISTS proyectos_faena_idx            ON gannet_demo.proyectos (faena_id);
CREATE INDEX IF NOT EXISTS proyectos_servicio_idx         ON gannet_demo.proyectos (servicio_id);
CREATE INDEX IF NOT EXISTS proyectos_responsable_idx      ON gannet_demo.proyectos (responsable_id);
CREATE INDEX IF NOT EXISTS proyectos_estado_inicio_idx    ON gannet_demo.proyectos (estado, fecha_inicio_plan DESC);

-- ordenes_trabajo
CREATE INDEX IF NOT EXISTS ot_cliente_idx                 ON gannet_demo.ordenes_trabajo (cliente_id);
CREATE INDEX IF NOT EXISTS ot_proyecto_idx                ON gannet_demo.ordenes_trabajo (proyecto_id);
CREATE INDEX IF NOT EXISTS ot_faena_idx                   ON gannet_demo.ordenes_trabajo (faena_id);
CREATE INDEX IF NOT EXISTS ot_servicio_idx                ON gannet_demo.ordenes_trabajo (servicio_id);
CREATE INDEX IF NOT EXISTS ot_responsable_idx             ON gannet_demo.ordenes_trabajo (responsable_id);
CREATE INDEX IF NOT EXISTS ot_vehiculo_idx                ON gannet_demo.ordenes_trabajo (vehiculo_id);
CREATE INDEX IF NOT EXISTS ot_equipo_idx                  ON gannet_demo.ordenes_trabajo (equipo_id);
CREATE INDEX IF NOT EXISTS ot_estado_programada_idx       ON gannet_demo.ordenes_trabajo (estado, fecha_programada DESC);
CREATE INDEX IF NOT EXISTS ot_estado_prioridad_idx        ON gannet_demo.ordenes_trabajo (estado, prioridad);
CREATE INDEX IF NOT EXISTS ot_fecha_inicio_idx            ON gannet_demo.ordenes_trabajo (fecha_inicio DESC);

-- ot_asignaciones y turnos
CREATE INDEX IF NOT EXISTS ot_asignaciones_empleado_idx   ON gannet_demo.ot_asignaciones (empleado_id);
CREATE INDEX IF NOT EXISTS ot_asignaciones_ot_idx         ON gannet_demo.ot_asignaciones (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS turnos_empleado_fecha_idx      ON gannet_demo.turnos (empleado_id, fecha DESC);
CREATE INDEX IF NOT EXISTS turnos_faena_idx               ON gannet_demo.turnos (faena_id);
CREATE INDEX IF NOT EXISTS turnos_ot_idx                  ON gannet_demo.turnos (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS turnos_fecha_estado_idx        ON gannet_demo.turnos (fecha DESC, estado);

-- cotizaciones
CREATE INDEX IF NOT EXISTS cotizaciones_cliente_idx       ON gannet_demo.cotizaciones (cliente_id);
CREATE INDEX IF NOT EXISTS cotizaciones_contacto_idx      ON gannet_demo.cotizaciones (contacto_id);
CREATE INDEX IF NOT EXISTS cotizaciones_proyecto_idx      ON gannet_demo.cotizaciones (proyecto_id);
CREATE INDEX IF NOT EXISTS cotizaciones_servicio_idx      ON gannet_demo.cotizaciones (servicio_principal_id);
CREATE INDEX IF NOT EXISTS cotizaciones_responsable_idx   ON gannet_demo.cotizaciones (responsable_comercial_id);
CREATE INDEX IF NOT EXISTS cotizaciones_estado_emision_idx ON gannet_demo.cotizaciones (estado, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS cotizacion_items_cotizacion_idx ON gannet_demo.cotizacion_items (cotizacion_id);
CREATE INDEX IF NOT EXISTS cotizacion_items_servicio_idx  ON gannet_demo.cotizacion_items (servicio_id);

-- facturas
CREATE INDEX IF NOT EXISTS facturas_cliente_idx           ON gannet_demo.facturas (cliente_id);
CREATE INDEX IF NOT EXISTS facturas_proyecto_idx          ON gannet_demo.facturas (proyecto_id);
CREATE INDEX IF NOT EXISTS facturas_ot_idx                ON gannet_demo.facturas (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS facturas_cotizacion_idx        ON gannet_demo.facturas (cotizacion_id);
CREATE INDEX IF NOT EXISTS facturas_estado_emision_idx    ON gannet_demo.facturas (estado, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS facturas_estado_vencimiento_idx ON gannet_demo.facturas (estado, fecha_vencimiento);

-- proveedores y compras
CREATE INDEX IF NOT EXISTS proveedores_rubro_activo_idx   ON gannet_demo.proveedores (rubro, activo);
CREATE INDEX IF NOT EXISTS oc_proveedor_idx               ON gannet_demo.ordenes_compra (proveedor_id);
CREATE INDEX IF NOT EXISTS oc_proyecto_idx                ON gannet_demo.ordenes_compra (proyecto_id);
CREATE INDEX IF NOT EXISTS oc_ot_idx                      ON gannet_demo.ordenes_compra (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS oc_solicitante_idx             ON gannet_demo.ordenes_compra (solicitante_id);
CREATE INDEX IF NOT EXISTS oc_deposito_destino_idx        ON gannet_demo.ordenes_compra (deposito_destino_id);
CREATE INDEX IF NOT EXISTS oc_estado_emision_idx          ON gannet_demo.ordenes_compra (estado, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS oc_items_oc_idx                ON gannet_demo.orden_compra_items (orden_compra_id);
CREATE INDEX IF NOT EXISTS oc_items_articulo_idx          ON gannet_demo.orden_compra_items (articulo_id);

-- movimientos_stock
CREATE INDEX IF NOT EXISTS mov_stock_articulo_idx         ON gannet_demo.movimientos_stock (articulo_id);
CREATE INDEX IF NOT EXISTS mov_stock_deposito_idx         ON gannet_demo.movimientos_stock (deposito_id);
CREATE INDEX IF NOT EXISTS mov_stock_ot_idx               ON gannet_demo.movimientos_stock (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS mov_stock_oc_idx               ON gannet_demo.movimientos_stock (orden_compra_id);
CREATE INDEX IF NOT EXISTS mov_stock_empleado_idx         ON gannet_demo.movimientos_stock (empleado_id);
CREATE INDEX IF NOT EXISTS mov_stock_tipo_fecha_idx       ON gannet_demo.movimientos_stock (tipo, fecha DESC);

-- mantenimientos
CREATE INDEX IF NOT EXISTS mant_vehiculo_idx              ON gannet_demo.mantenimientos (vehiculo_id);
CREATE INDEX IF NOT EXISTS mant_equipo_idx                ON gannet_demo.mantenimientos (equipo_id);
CREATE INDEX IF NOT EXISTS mant_proveedor_idx             ON gannet_demo.mantenimientos (proveedor_id);
CREATE INDEX IF NOT EXISTS mant_responsable_idx           ON gannet_demo.mantenimientos (responsable_id);
CREATE INDEX IF NOT EXISTS mant_estado_fecha_idx          ON gannet_demo.mantenimientos (estado, fecha DESC);

-- actividades
CREATE INDEX IF NOT EXISTS actividades_cliente_idx        ON gannet_demo.actividades (cliente_id);
CREATE INDEX IF NOT EXISTS actividades_contacto_idx       ON gannet_demo.actividades (contacto_id);
CREATE INDEX IF NOT EXISTS actividades_proyecto_idx       ON gannet_demo.actividades (proyecto_id);
CREATE INDEX IF NOT EXISTS actividades_ot_idx             ON gannet_demo.actividades (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS actividades_cotizacion_idx     ON gannet_demo.actividades (cotizacion_id);
CREATE INDEX IF NOT EXISTS actividades_autor_idx          ON gannet_demo.actividades (autor_id);
CREATE INDEX IF NOT EXISTS actividades_fecha_idx          ON gannet_demo.actividades (fecha DESC);
CREATE INDEX IF NOT EXISTS actividades_estado_fecha_idx   ON gannet_demo.actividades (estado, fecha DESC);
CREATE INDEX IF NOT EXISTS actividades_tipo_fecha_idx     ON gannet_demo.actividades (tipo, fecha DESC);

-- documentos
CREATE INDEX IF NOT EXISTS documentos_cliente_idx         ON gannet_demo.documentos (cliente_id);
CREATE INDEX IF NOT EXISTS documentos_proyecto_idx        ON gannet_demo.documentos (proyecto_id);
CREATE INDEX IF NOT EXISTS documentos_ot_idx              ON gannet_demo.documentos (orden_trabajo_id);
CREATE INDEX IF NOT EXISTS documentos_empleado_idx        ON gannet_demo.documentos (empleado_id);
CREATE INDEX IF NOT EXISTS documentos_vehiculo_idx        ON gannet_demo.documentos (vehiculo_id);
CREATE INDEX IF NOT EXISTS documentos_equipo_idx          ON gannet_demo.documentos (equipo_id);
CREATE INDEX IF NOT EXISTS documentos_tipo_vencimiento_idx ON gannet_demo.documentos (tipo, fecha_vencimiento);

-- =============================================================================
-- SEMILLA — las diez lineas de servicio de Andes Servicios Integrales
-- Es dato de configuracion, no dato transaccional: se carga aqui para que
-- cualquier base recien creada quede utilizable sin depender del generador.
-- =============================================================================

INSERT INTO gannet_demo.servicios (codigo, nombre, descripcion, unidad_facturacion) VALUES
  ('MANT_IND',   'Mantenimiento industrial',            'Mantenimiento preventivo y correctivo de instalaciones y maquinaria de planta.',            'hora'),
  ('OBRA_CIVIL', 'Obras civiles',                       'Ejecucion de obras de infraestructura: fundaciones, platea, caminos y estructuras.',        'global'),
  ('ELEC_IND',   'Electricidad industrial',             'Montaje, tendido y mantenimiento de instalaciones electricas de media y baja tension.',     'hora'),
  ('INST_AUTO',  'Instrumentación y automatización',    'Instalacion, calibracion y puesta en marcha de instrumentos y sistemas de control.',        'hora'),
  ('SOLD_MONT',  'Soldadura y montaje',                 'Soldadura calificada y montaje de estructuras metalicas, canerias y equipos.',              'jornada'),
  ('TRANS_LOG',  'Transporte y logística',              'Transporte de cargas, insumos y personal hacia y desde faena.',                             'km'),
  ('ALQ_MAQ',    'Alquiler de maquinaria y equipos',    'Provision de maquinaria y equipos en alquiler, con o sin operador.',                        'jornada'),
  ('MOV_SUELO',  'Movimiento de suelos',                'Excavacion, nivelacion, relleno y compactacion de terreno.',                                'm3'),
  ('SERV_CAMP',  'Servicios de campamento',             'Operacion de campamentos: alojamiento, comedor y servicios generales para el personal.',    'mes'),
  ('LIMP_IND',   'Limpieza industrial',                 'Limpieza tecnica de plantas, equipos, tanques y areas operativas.',                         'jornada')
ON CONFLICT (codigo) DO NOTHING;

-- =============================================================================
-- ROW LEVEL SECURITY — negacion por defecto
-- Se habilita RLS en todas las tablas del esquema y no se define ninguna
-- politica. Resultado: ningun rol sujeto a RLS puede leer ni escribir.
-- El acceso legitimo llega por dos caminos: `service_role`, que evita RLS, y
-- las vistas `public.gd_*` de la migracion posterior, propiedad de un rol
-- privilegiado, que exponen solo lectura agregada.
-- =============================================================================

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'gannet_demo' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE gannet_demo.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END;
$$;

-- =============================================================================
-- PRIVILEGIOS — modo kiosco
-- El esquema queda cerrado. La aplicacion de la demo lee a traves de las vistas
-- `public.gd_*`, que se crean en la migracion siguiente y son las unicas que
-- reciben SELECT para `anon` y `authenticated`. Las tablas base nunca se
-- exponen directamente.
-- =============================================================================

REVOKE ALL ON SCHEMA gannet_demo FROM PUBLIC;
REVOKE ALL ON ALL TABLES    IN SCHEMA gannet_demo FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA gannet_demo FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA gannet_demo FROM anon;
    REVOKE ALL ON ALL TABLES    IN SCHEMA gannet_demo FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA gannet_demo FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA gannet_demo FROM authenticated;
    REVOKE ALL ON ALL TABLES    IN SCHEMA gannet_demo FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA gannet_demo FROM authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT USAGE ON SCHEMA gannet_demo TO service_role;
    GRANT ALL ON ALL TABLES    IN SCHEMA gannet_demo TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA gannet_demo TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA gannet_demo GRANT ALL ON TABLES    TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA gannet_demo GRANT ALL ON SEQUENCES TO service_role;
  END IF;
END;
$$;

COMMIT;
