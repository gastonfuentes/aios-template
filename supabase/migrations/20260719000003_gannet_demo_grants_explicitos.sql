-- ============================================================================
-- Gannet OS — Demo Congreso Minero
-- Otorgamiento explícito de privilegios sobre las vistas públicas gd_*
--
-- MOTIVO
-- La migración 20260719000002 otorgaba SELECT a anon/authenticated recorriendo
-- pg_class con el patrón `relname LIKE 'gd\_%'`. Ese criterio tiene dos
-- defectos:
--
--   1. Otorga sobre vistas que ninguna ruta pública consume, ampliando la
--      superficie de lectura sin que nadie lo haya decidido.
--   2. Toda vista gd_* que se cree en el futuro queda expuesta automáticamente,
--      sin revisión. El permiso se concede por omisión, no por decisión.
--
-- Una auditoría de seguridad detectó que 33 vistas tenían SELECT para anon
-- mientras la lista de la aplicación declaraba 21. Los datos son ficticios, de
-- modo que el impacto fue nulo, pero el mecanismo es el que importa: la lista
-- de la aplicación NO es el límite de seguridad. El GRANT en la base lo es.
-- PostgREST publica las vistas directamente y desconoce por completo la lista
-- que mantiene la aplicación.
--
-- CRITERIO DE ESTA MIGRACIÓN
-- El otorgamiento pasa a hacerse sobre una lista explícita. Sumar una vista a
-- la superficie pública ahora exige editar esta lista, lo que deja el cambio
-- registrado en el control de versiones y sujeto a revisión.
--
-- Toda vista gd_* que exista y no figure en la lista queda revocada.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Vistas consumidas por las 12 rutas públicas de la demo.
  vistas_publicas text[] := ARRAY[
    -- Portada
    'gd_kpi_ejecutivo',
    'gd_facturacion_mensual',
    'gd_ingresos_por_servicio',
    'gd_actividad_reciente',
    'gd_agenda_proxima',
    -- Clientes
    'gd_clientes',
    'gd_cliente_detalle',
    'gd_ranking_clientes',
    'gd_contactos',
    'gd_faenas',
    -- Comercial
    'gd_cotizaciones',
    'gd_pipeline_cotizaciones',
    -- Proyectos
    'gd_proyectos',
    'gd_proyectos_estado',
    'gd_margen_por_proyecto',
    -- Órdenes de trabajo
    'gd_ot_operativas',
    'gd_ot_carga_operativa',
    'gd_ot_cumplimiento',
    -- Compras y almacén
    'gd_ordenes_compra',
    'gd_compras_por_proveedor',
    'gd_proveedores',
    'gd_articulos',
    'gd_stock_critico',
    -- Activos
    'gd_equipos',
    'gd_equipos_disponibilidad',
    'gd_vehiculos',
    'gd_flota_estado',
    -- Personal
    'gd_empleados',
    'gd_rrhh_resumen',
    -- Facturación
    'gd_facturas',
    'gd_cobranzas_aging',
    -- Documentación
    'gd_documentos',
    'gd_documentos_vencimientos'
  ];
  v            text;
  faltantes    text[] := '{}';
  revocadas    text[] := '{}';
BEGIN
  -- Toda vista gd_* existente parte sin privilegios para los roles públicos.
  FOR v IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname LIKE 'gd\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', v);
    IF NOT (v = ANY (vistas_publicas)) THEN
      revocadas := revocadas || v;
    END IF;
  END LOOP;

  -- Solo las vistas de la lista recuperan SELECT.
  FOREACH v IN ARRAY vistas_publicas LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname = v
    ) THEN
      EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated;', v);
    ELSE
      faltantes := faltantes || v;
    END IF;
  END LOOP;

  IF array_length(faltantes, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'La lista pública nombra vistas inexistentes: %. Corregir la lista o crear las vistas.',
      array_to_string(faltantes, ', ');
  END IF;

  IF array_length(revocadas, 1) IS NOT NULL THEN
    RAISE NOTICE
      'Vistas gd_* revocadas por no figurar en la lista pública: %',
      array_to_string(revocadas, ', ');
  END IF;
END $$;

-- ============================================================================
-- Aserciones de cierre. La migración aborta antes de dejar un privilegio
-- indebido: es preferible fallar en el despliegue que abrir una brecha en
-- silencio.
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  -- Ninguna vista gd_* admite escritura desde los roles públicos.
  FOR r IN
    SELECT c.relname, rol
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['anon','authenticated']) AS rol
    WHERE n.nspname = 'public'
      AND c.relkind = 'v'
      AND c.relname LIKE 'gd\_%'
      AND (has_table_privilege(rol, c.oid, 'INSERT')
        OR has_table_privilege(rol, c.oid, 'UPDATE')
        OR has_table_privilege(rol, c.oid, 'DELETE')
        OR has_table_privilege(rol, c.oid, 'TRUNCATE'))
  LOOP
    RAISE EXCEPTION 'La vista public.% admite escritura para el rol %.', r.relname, r.rol;
  END LOOP;

  -- Las tablas base permanecen inaccesibles para los roles públicos.
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
      'La tabla base gannet_demo.% es legible por el rol %. La lectura debe pasar por las vistas.',
      r.relname, r.rol;
  END LOOP;
END $$;

COMMIT;
