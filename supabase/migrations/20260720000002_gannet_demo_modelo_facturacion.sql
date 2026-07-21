-- =============================================================================
-- Gannet OS — Demo Congreso Minero
-- Modelo de facturacion mensual: la curva de "Evolucion de facturacion" tiene
-- que leerse como una empresa, no como una serie de numeros aleatorios
-- =============================================================================
--
-- WHY THIS MIGRATION EXISTS
--
--   `public.gd_facturacion_mensual` feeds the FIRST chart of
--   `/dashboard-ejecutivo`, the opening screen of a three-minute pitch. The
--   seeded series read like noise:
--
--     2025-02      103.676.015     2025-11    4.249.502.286
--     2025-03      164.326.197     2025-12    5.725.249.813
--     2025-04    1.351.583.486     2026-01    4.930.195.851
--     ...                          2026-04   11.193.393.895
--                                  2026-05    4.281.002.143
--                                  2026-06    7.572.501.479
--                                  2026-07    3.749.436.314
--
--   Three separate defects, three separate root causes.
--
--   1. IMPLAUSIBLE VOLATILITY (-62%, +77%, -50% on consecutive months; a 108:1
--      max/min ratio). The generator drew every progress-certificate invoice
--      independently from a flat range of 18 M to 320 M ARS. With only ~20
--      certificates in a month, four or five draws near the top of the range
--      moved the monthly total by billions. Nothing in the generator ever
--      looked at a monthly total, so no month knew what the month before it had
--      billed. A services company on mining contracts does not bill like that:
--      its month is the sum of framework contracts that carry over, not of
--      twenty independent coin flips.
--
--   2. NEAR-ZERO RAMP AT THE START. February and March 2025 sat at ~100-160 M
--      against a later average in the billions. That is an artifact of the seed
--      window, not history: certificate emission dates were drawn uniformly
--      over the trailing 470 days and then clamped forward to the project start
--      date, so the oldest months of the chart could only ever collect the few
--      invoices whose project had already begun. On a projector it reads as a
--      company that did not exist eighteen months ago. The chart shows a
--      trailing window; the first month of that window has to be a going
--      concern.
--
--   3. THE LAST POINT WAS AN INCOMPLETE MONTH. The view's window ended on
--      `date_trunc('month', CURRENT_DATE)`, so the current month — twenty of
--      thirty-one days billed on the day of the congress — was plotted beside
--      complete months. The curve appeared to collapse at exactly the visual
--      close of the opening chart.
--
-- WHAT THIS MIGRATION DOES
--
--   It gives the demo an explicit, auditable revenue model — a trend, a
--   seasonal profile and a bounded monthly wobble — and reshapes the
--   progress-certificate leg of `gannet_demo.facturas` so the monthly emitted
--   total lands on that model.
--
--   Only the certificate leg moves. The 620 invoices that originate in a
--   completed work order are NOT touched: their emission date is tied to
--   `ordenes_trabajo.fecha_fin` and moving them would break the one link a
--   visitor can actually drill into. The certificate leg is the natural
--   instrument anyway — a supplier on framework contracts certifies progress
--   monthly, and that is the stream that carries a company's baseline revenue.
--
--   Arithmetic: the model fixes a target per month, the work-order leg and the
--   credit/debit notes already sitting in that month are subtracted, and the
--   remainder is spread across the certificates assigned to it. The monthly
--   total therefore matches the model to the cent, with no month aware of any
--   other and no random draw anywhere.
--
-- WHY A PARAMETER TABLE AND A FUNCTION, NOT AN UPDATE SCRIPT
--
--   Same reason as 20260720000001. The generator has to produce exactly what
--   this migration produces or the laptop fallback and the VPS stop matching.
--   The logic lives once, in `gannet_demo.aplicar_modelo_facturacion()`; the
--   migration runs it over already-seeded data and the generator calls it at
--   the end of its own run. The shape of the curve lives in
--   `gannet_demo.modelo_facturacion` and
--   `gannet_demo.modelo_facturacion_estacional`, so tuning it is editing two
--   rows of data, not rewriting a formula buried in an UPDATE.
--
-- DETERMINISM
--
--   No `random()`, no `setseed()`. Every choice is md5 of the row identity plus
--   a salt, exactly like the generator's `gannet_demo.sem_h`. `sem_h` does not
--   exist at migration time — the generator drops it in its last lines — so the
--   body is written inline and section 6 asserts the inline expression still
--   agrees with the generator's definition.
--
-- SEEDED DELINQUENCY LEVELS
--
--   The operator reviewed and kept the seeded delinquency levels (see
--   docs/demo-congreso-minero.md). This migration reuses the generator's own
--   collection rules — same salts, same probability table, same 88% overdue
--   concentration on the delinquent client — so the proportions survive the
--   reshaping. It does not re-open that decision.
--
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. gannet_demo.modelo_facturacion — trend parameters
-- =============================================================================
-- One row. `base_ars` is the trend level at the oldest month of the modelled
-- window, before seasonality. `crecimiento_mensual` compounds from there.
--
-- The growth rate is nominal ARS. In Argentina a supplier whose monthly billing
-- roughly doubles over eighteen months is not describing a doubling of physical
-- activity, and an audience from the industry reads it that way without being
-- told.
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.modelo_facturacion (
  id                  int PRIMARY KEY DEFAULT 1,
  base_ars            numeric(16,2) NOT NULL,
  crecimiento_mensual numeric(8,6)  NOT NULL,
  amplitud_ruido      numeric(8,6)  NOT NULL,
  meses_ventana       int           NOT NULL,
  meses_previos       int           NOT NULL,
  piso_residuo_pct    numeric(8,6)  NOT NULL,
  dias_mora_maxima    int           NOT NULL,
  CONSTRAINT modelo_facturacion_fila_unica    CHECK (id = 1),
  CONSTRAINT modelo_facturacion_base_check    CHECK (base_ars > 0),
  CONSTRAINT modelo_facturacion_crec_check    CHECK (crecimiento_mensual BETWEEN -0.5 AND 0.5),
  CONSTRAINT modelo_facturacion_ruido_check   CHECK (amplitud_ruido BETWEEN 0 AND 0.3),
  CONSTRAINT modelo_facturacion_ventana_check CHECK (meses_ventana BETWEEN 12 AND 36),
  CONSTRAINT modelo_facturacion_previos_check CHECK (meses_previos BETWEEN 0 AND 12),
  CONSTRAINT modelo_facturacion_piso_check    CHECK (piso_residuo_pct BETWEEN 0 AND 1),
  CONSTRAINT modelo_facturacion_mora_check    CHECK (dias_mora_maxima BETWEEN 90 AND 3650)
);

COMMENT ON TABLE gannet_demo.modelo_facturacion IS
  'Parametros de tendencia del modelo de facturacion mensual de la demo. Una sola fila. Define el nivel de partida, el crecimiento compuesto mes a mes, la amplitud del ruido idiosincratico y cuantos meses hacia atras se modelan.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion.base_ars IS
  'Nivel de tendencia en el mes mas viejo de la ventana modelada, antes de aplicar estacionalidad y ruido.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion.crecimiento_mensual IS
  'Crecimiento compuesto mes a mes de la tendencia. Es crecimiento nominal en pesos, no crecimiento de actividad fisica.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion.amplitud_ruido IS
  'Amplitud maxima del desvio idiosincratico de cada mes respecto de tendencia por estacionalidad, en tanto por uno. Da vida a la curva sin romper la lectura de negocio.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion.meses_ventana IS
  'Cantidad de meses cerrados que dibuja el grafico. El modelo cubre estos meses mas el mes en curso mas los meses de arranque.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion.meses_previos IS
  'Meses modelados por delante de la ventana del grafico, con nivel reducido en rampa. No se ven en la curva: existen para que el primer mes de la ventana ya tenga comprobantes viejos que cobrar, porque la cobranza de un mes es la facturacion de los meses anteriores.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion.dias_mora_maxima IS
  'Dias de mora a partir de los cuales un comprobante deja de figurar vencido: o se cobro tarde o se dio de baja. Ninguna empresa arrastra un vencido de mas de un anio en su cuenta corriente, y el tramo mas alto del informe de antiguedad de la propia demo es "mas de 90 dias".';
COMMENT ON COLUMN gannet_demo.modelo_facturacion.piso_residuo_pct IS
  'Piso del monto que queda para certificaciones cuando la facturacion por orden de trabajo de ese mes ya se acerca al objetivo. Evita residuos nulos o negativos.';

REVOKE ALL ON gannet_demo.modelo_facturacion FROM PUBLIC, anon, authenticated;

-- El nivel base esta elegido para que el primer mes de la ventana del grafico
-- abra cerca de 2.800 millones y el ultimo mes cerrado llegue cerca de 5.400,
-- con un maximo sobre minimo de aproximadamente 2,2 a 1 en dieciocho meses.
INSERT INTO gannet_demo.modelo_facturacion
  (id, base_ars, crecimiento_mensual, amplitud_ruido, meses_ventana, meses_previos,
   piso_residuo_pct, dias_mora_maxima)
VALUES
  (1, 3200000000.00, 0.036000, 0.050000, 18, 3, 0.100000, 330)
ON CONFLICT (id) DO UPDATE SET
  base_ars            = EXCLUDED.base_ars,
  crecimiento_mensual = EXCLUDED.crecimiento_mensual,
  amplitud_ruido      = EXCLUDED.amplitud_ruido,
  meses_ventana       = EXCLUDED.meses_ventana,
  meses_previos       = EXCLUDED.meses_previos,
  piso_residuo_pct    = EXCLUDED.piso_residuo_pct,
  dias_mora_maxima    = EXCLUDED.dias_mora_maxima;

-- =============================================================================
-- 2. gannet_demo.modelo_facturacion_estacional — seasonal profile
-- =============================================================================
-- Argentine mining seasonality, from the supplier's side:
--
--   * January collapses. Construction and industrial services take their annual
--     shutdown and the mines run skeleton crews.
--   * The puna winter (June to August) is the second trough: altitude, snow and
--     short daylight cut field productivity, and earthmoving and civil works
--     largely stop.
--   * March-April and October-November are the two peaks — the shoulder seasons
--     when the sites are accessible and the annual maintenance windows land.
--   * December softens again against the holidays and the fiscal year close.
--
-- The coefficients are normalised by their own mean when applied, so editing
-- one month re-levels the rest instead of shifting the whole curve.
-- =============================================================================

CREATE TABLE IF NOT EXISTS gannet_demo.modelo_facturacion_estacional (
  mes_del_ano int           PRIMARY KEY,
  coeficiente numeric(8,4)  NOT NULL,
  nota        text          NOT NULL,
  CONSTRAINT modelo_estacional_mes_check  CHECK (mes_del_ano BETWEEN 1 AND 12),
  CONSTRAINT modelo_estacional_coef_check CHECK (coeficiente BETWEEN 0.3 AND 2.0)
);

COMMENT ON TABLE gannet_demo.modelo_facturacion_estacional IS
  'Perfil estacional de la facturacion, un coeficiente por mes calendario. Modela el parate de enero, el invierno punenio de junio a agosto y los dos picos de temporada intermedia. Se normaliza por su propia media al aplicarse.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion_estacional.coeficiente IS
  'Multiplicador estacional del mes. Uno es un mes promedio del anio.';
COMMENT ON COLUMN gannet_demo.modelo_facturacion_estacional.nota IS
  'Razon de negocio del coeficiente. Es lo que se responde si alguien en el congreso pregunta por que cae el invierno.';

REVOKE ALL ON gannet_demo.modelo_facturacion_estacional FROM PUBLIC, anon, authenticated;

INSERT INTO gannet_demo.modelo_facturacion_estacional (mes_del_ano, coeficiente, nota) VALUES
  ( 1, 0.8600, 'Enero: parate de la industria y dotacion minima en faena.'),
  ( 2, 0.9600, 'Febrero: reactivacion parcial, la obra vuelve a mitad de mes.'),
  ( 3, 1.0800, 'Marzo: primer pico, ventanas de mantenimiento anual.'),
  ( 4, 1.1000, 'Abril: pico de temporada intermedia, mejor acceso a faena.'),
  ( 5, 1.0500, 'Mayo: cierre de la temporada previo al invierno.'),
  ( 6, 0.9300, 'Junio: entra el invierno punenio, cae el movimiento de suelos.'),
  ( 7, 0.8800, 'Julio: piso del invierno, nieve y jornada corta en altura.'),
  ( 8, 0.9400, 'Agosto: sigue el invierno, empieza a recuperar sobre el cierre.'),
  ( 9, 1.0400, 'Septiembre: reapertura de frentes de obra.'),
  (10, 1.1000, 'Octubre: segundo pico, ventanas de parada de planta.'),
  (11, 1.1200, 'Noviembre: maximo del anio, se corre obra antes de las fiestas.'),
  (12, 0.9800, 'Diciembre: fiestas y cierre de ejercicio, se factura menos dias.')
ON CONFLICT (mes_del_ano) DO UPDATE SET
  coeficiente = EXCLUDED.coeficiente,
  nota        = EXCLUDED.nota;

-- =============================================================================
-- 3. gannet_demo.aplicar_modelo_facturacion() — la unica copia de la logica
-- =============================================================================
-- Reescribe la pata de certificaciones de `gannet_demo.facturas` para que el
-- total emitido de cada mes caiga sobre el modelo.
--
-- QUE ES LA PATA DE CERTIFICACIONES
--
--   Las facturas sin orden de trabajo y de tipo factura A, B o C. Son las
--   certificaciones de avance de proyecto: 300 de los 980 comprobantes. Las 620
--   que nacen de una orden de trabajo terminada y las 60 notas de credito y
--   debito quedan intactas, y se restan del objetivo como monto ya fijado.
--
-- ORDEN DE LAS ETAPAS — importa
--
--   a. Objetivo por mes y monto ya fijado por la pata que no se toca.
--   b. Cuantas certificaciones entran en cada mes.
--   c. Que certificacion cae en que mes, contra que proyecto y en que fecha, y
--      con que estado de cobranza.
--   d. Recien entonces los importes, repartiendo el residuo SOLO entre las
--      certificaciones que no quedaron anuladas: la vista del grafico excluye
--      las anuladas, y si el importe se asignara antes del estado el total del
--      mes quedaria por debajo del objetivo.
--
-- Es idempotente: todo sale de md5 sobre el id de la fila mas una sal fija y
-- del contenido de las dos tablas de parametros.
-- =============================================================================

CREATE OR REPLACE FUNCTION gannet_demo.aplicar_modelo_facturacion()
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_mes_actual date := date_trunc('month', CURRENT_DATE)::date;
  v_previos    int;
  v_meses      int;
  v_mora       int;
  v_certs      int;
  v_cupo_total bigint;
  v_i          int;
  v_mes        date;
  v_sin_mes    bigint;
BEGIN

-- Meses modelados = arranque en rampa + ventana del grafico + mes en curso.
SELECT meses_previos, meses_previos + meses_ventana + 1, dias_mora_maxima
  INTO v_previos, v_meses, v_mora
FROM gannet_demo.modelo_facturacion WHERE id = 1;

IF v_meses IS NULL THEN
  RAISE EXCEPTION 'Falta la fila de parametros en gannet_demo.modelo_facturacion.';
END IF;

-- ---------------------------------------------------------------------------
-- 3.0  La mora vieja se resuelve
-- ---------------------------------------------------------------------------
-- EFECTO SECUNDARIO DE ARREGLAR LA RAMPA. Mientras el arranque de la serie
-- estaba casi vacio, no habia comprobantes viejos que pudieran quedar vencidos.
-- Al poblar 2025 con volumen real aparecieron veintiseis facturas vencidas hace
-- mas de un anio, la mas vieja por 582 dias: casi diez mil millones de mora
-- ancestral que ninguna empresa arrastra en su cuenta corriente, y que ademas
-- se sale del tramo mas alto del propio informe de antiguedad de la demo
-- ("vencido mas de 90 dias").
--
-- Pasado el limite, un comprobante se cobro tarde o se dio de baja. Cuatro de
-- cada cinco terminan cobrados y el resto anulados.
--
-- ESTO NO ES ABLANDAR LA MOROSIDAD SEMBRADA. La tasa de mora sobre la
-- facturacion reciente — que es la que miran el tablero de cobranzas, el
-- informe de antiguedad y la historia del cliente moroso — queda intacta: la
-- regla solo alcanza a lo que ya paso el limite de mora. Lo que se corrige es
-- una acumulacion que antes no existia porque no habia historia que acumular.
--
-- Corre ANTES de que 3.a mida el monto ya fijado de cada mes: si un comprobante
-- de la pata intocable pasara a anulado despues de esa medicion, el mes se
-- quedaria corto contra su objetivo. La pata de certificaciones aplica la misma
-- regla dentro de 3.c, cuando recien ahi tiene fecha de vencimiento definitiva.
--
-- Idempotente: en la segunda corrida ya no queda ningun vencido pasado el
-- limite, asi que no encuentra filas y el estado final es el mismo.

UPDATE gannet_demo.facturas f
SET estado      = r.estado,
    fecha_cobro = CASE WHEN r.estado = 'cobrada'
                       THEN LEAST(f.fecha_vencimiento + 30 + r.demora, CURRENT_DATE)
                       ELSE NULL END
FROM (
  SELECT
    f2.id,
    CASE WHEN ((('x' || substr(md5(f2.id::text || ':' || 3070::text), 1, 8))::bit(32)::int)::bigint
               + 2147483648) % 100 < 80 THEN 'cobrada' ELSE 'anulada' END AS estado,
    (((('x' || substr(md5(f2.id::text || ':' || 3071::text), 1, 8))::bit(32)::int)::bigint
      + 2147483648) % 121)::int AS demora
  FROM gannet_demo.facturas f2
  WHERE f2.estado = 'vencida'
    AND f2.fecha_vencimiento < CURRENT_DATE - v_mora
    AND NOT (f2.orden_trabajo_id IS NULL
             AND f2.tipo_comprobante IN ('factura_a','factura_b','factura_c'))
) r
WHERE f.id = r.id;

-- ---------------------------------------------------------------------------
-- 3.0.b  Las notas de credito y debito se imputan, no quedan abiertas
-- ---------------------------------------------------------------------------
-- DOS PANTALLAS DECIAN NUMEROS DISTINTOS PARA "COBRANZA VENCIDA". El panel
-- ejecutivo mostraba 13,0 mil M y el modulo de facturacion 13,9 mil M. La
-- diferencia exacta eran cincuenta y dos notas de credito y debito.
--
-- El generador les fija `estado = 'emitida'` de por vida — nunca entran en la
-- rueda de cobranza — pero igual les calcula fecha de vencimiento. El panel
-- suma por ESTADO ('vencida') y no las cuenta; el informe de antiguedad
-- clasifica por FECHA sobre la misma poblacion pendiente y sí las cuenta, en el
-- tramo de mas de noventa dias. Las dos vistas son viejas y la discrepancia es
-- anterior a este trabajo, pero estaba escondida: mientras el arranque de la
-- serie estaba vacio las notas eran pocas y jovenes. Al poblar 2025 pasaron a
-- ser 883 millones de deuda fantasma, con notas "vencidas" hace 413 dias.
--
-- Ademas de descuadrar dos pantallas, es un error conceptual: una nota de
-- credito es plata que Andes le debe al cliente, no una cuenta por cobrar, y
-- ninguna de las dos se queda un anio abierta. Se imputan contra la cuenta
-- corriente al vencer, que es lo que hace cualquier administracion.
--
-- Con esto las dos vistas quedan sobre exactamente la misma poblacion y los dos
-- carteles dicen el mismo numero. La seccion 7 lo verifica.
--
-- Idempotente: en la segunda corrida ya no queda ninguna nota vencida abierta.

UPDATE gannet_demo.facturas f
SET estado      = 'cobrada',
    fecha_cobro = LEAST(
      GREATEST(
        f.fecha_vencimiento
          + ((((('x' || substr(md5(f.id::text || ':' || 3080::text), 1, 8))::bit(32)::int)::bigint
               + 2147483648) % 15)::int - 7),
        f.fecha_emision + 1),
      CURRENT_DATE)
WHERE f.tipo_comprobante IN ('nota_credito','nota_debito')
  AND f.estado = 'emitida'
  AND f.fecha_vencimiento < CURRENT_DATE;

-- ---------------------------------------------------------------------------
-- 3.a  Meses modelados: objetivo, monto ya fijado y residuo a repartir
-- ---------------------------------------------------------------------------
-- El mes en curso se prorratea por los dias transcurridos. Una certificacion no
-- se puede emitir en el futuro, y pedirle a julio el volumen de un mes cerrado
-- obligaria a concentrar veinte dias de facturacion como si fueran treinta y
-- uno — que es justamente el defecto opuesto al que se esta corrigiendo.
--
-- `cupo` acota cuantas certificaciones tolera un mes: dos por proyecto activo.
-- Un contrato marco que certifica dos veces en el mes es corriente, uno que
-- certifica cinco no lo es, y los meses mas viejos de la ventana tienen pocos
-- proyectos abiertos.

DROP TABLE IF EXISTS tmp_mf_mes;
CREATE TEMP TABLE tmp_mf_mes AS
WITH par AS (
  SELECT base_ars, crecimiento_mensual, amplitud_ruido, piso_residuo_pct
  FROM gannet_demo.modelo_facturacion WHERE id = 1
),
coef_medio AS (
  SELECT AVG(coeficiente) AS m FROM gannet_demo.modelo_facturacion_estacional
),
meses AS (
  SELECT
    g AS k,
    (v_mes_actual - ((v_meses - 1 - g) || ' months')::interval)::date AS mes
  FROM generate_series(0, v_meses - 1) AS g
),
objetivo AS (
  SELECT
    m.k,
    m.mes,
    (m.mes + INTERVAL '1 month' - INTERVAL '1 day')::date AS fin_mes,
    extract(day FROM (m.mes + INTERVAL '1 month' - INTERVAL '1 day'))::int AS dias_mes,
    CASE WHEN m.mes = v_mes_actual
         THEN extract(day FROM CURRENT_DATE)::int
         ELSE extract(day FROM (m.mes + INTERVAL '1 month' - INTERVAL '1 day'))::int
    END AS dias_corridos,
    round(
      p.base_ars
      -- El nivel base esta anclado en el PRIMER mes de la ventana del grafico,
      -- no en el primer mes modelado: los meses de arranque quedan con
      -- exponente negativo, que es lo correcto porque son anteriores.
      * power(1 + p.crecimiento_mensual, m.k - v_previos)
      -- Rampa de arranque. Los meses previos a la ventana existen solo para
      -- alimentar la cobranza del primer mes que si se dibuja, asi que entran
      -- a nivel reducido y creciente. Tambien los mantiene dentro del importe
      -- de certificacion corriente pese a tener pocos proyectos abiertos.
      * CASE WHEN m.k < v_previos
             THEN (m.k + 1)::numeric / (v_previos + 1)::numeric
             ELSE 1 END
      * (e.coeficiente / cm.m)
      -- Ruido idiosincratico determinista: sal 3010 sobre el indice del mes.
      -- Inlined gannet_demo.sem_h(m.k, 3010).
      * (1 + p.amplitud_ruido
             * (((((('x' || substr(md5(m.k::text || ':' || 3010::text), 1, 8))::bit(32)::int)::bigint
                   + 2147483648) % 2001)::numeric - 1000) / 1000))
    , 2) AS objetivo_pleno
  FROM meses m
  CROSS JOIN par p
  CROSS JOIN coef_medio cm
  JOIN gannet_demo.modelo_facturacion_estacional e
    ON e.mes_del_ano = extract(month FROM m.mes)::int
),
fijo AS (
  -- Lo que ya factura la pata intocable dentro de cada mes modelado.
  SELECT o.k,
         COALESCE(SUM(f.total_ars), 0) AS fijo_ars
  FROM objetivo o
  LEFT JOIN gannet_demo.facturas f
    ON f.estado <> 'anulada'
   AND f.fecha_emision >= o.mes
   AND f.fecha_emision <= o.fin_mes
   AND NOT (f.orden_trabajo_id IS NULL
            AND f.tipo_comprobante IN ('factura_a','factura_b','factura_c'))
  GROUP BY o.k
),
activos AS (
  SELECT o.k, COUNT(p.id) AS proyectos_activos
  FROM objetivo o
  LEFT JOIN gannet_demo.proyectos p
    ON p.estado <> 'planificado'
   AND COALESCE(p.fecha_inicio_real, p.fecha_inicio_plan) <= o.fin_mes
   AND COALESCE(p.fecha_fin_real, p.fecha_fin_plan, DATE '9999-12-31') >= o.mes
  GROUP BY o.k
)
SELECT
  o.k,
  o.mes,
  o.fin_mes,
  o.dias_mes,
  o.dias_corridos,
  round(o.objetivo_pleno * o.dias_corridos / o.dias_mes, 2) AS objetivo_ars,
  fj.fijo_ars,
  GREATEST(
    round(o.objetivo_pleno * o.dias_corridos / o.dias_mes, 2) - fj.fijo_ars,
    round(o.objetivo_pleno * o.dias_corridos / o.dias_mes * pa.piso_residuo_pct, 2)
  ) AS residuo_ars,
  GREATEST(2 * ac.proyectos_activos, 4) AS cupo,
  0::bigint AS asignados
FROM objetivo o
CROSS JOIN (SELECT piso_residuo_pct FROM gannet_demo.modelo_facturacion WHERE id = 1) pa
JOIN fijo    fj ON fj.k = o.k
JOIN activos ac ON ac.k = o.k;

CREATE UNIQUE INDEX ON tmp_mf_mes (k);
CREATE UNIQUE INDEX ON tmp_mf_mes (mes);

-- ---------------------------------------------------------------------------
-- 3.b  Cuantas certificaciones entran en cada mes
-- ---------------------------------------------------------------------------
-- Reparto proporcional al residuo por el metodo del divisor: cada certificacion
-- va al mes que maximiza `residuo / (asignadas + 1)`, saltando los meses que ya
-- llegaron a su cupo.
--
-- La propiedad que se busca no es la proporcionalidad en si. Es que el importe
-- medio de una certificacion quede parejo en toda la ventana: si un mes recibe
-- certificaciones en proporcion a lo que tiene para facturar, ninguna
-- certificacion sale desproporcionada respecto de las demas, y la grilla de
-- /facturacion no delata que los meses viejos fueron inflados.
--
-- Determinismo: el desempate por `mes` hace que el orden de evaluacion del
-- motor no pueda influir en el resultado.

SELECT COUNT(*) INTO v_certs
FROM gannet_demo.facturas
WHERE orden_trabajo_id IS NULL
  AND tipo_comprobante IN ('factura_a','factura_b','factura_c');

SELECT SUM(cupo) INTO v_cupo_total FROM tmp_mf_mes;
IF v_cupo_total < v_certs THEN
  RAISE EXCEPTION
    'El cupo de certificaciones (%) no alcanza para las % facturas de la pata de certificaciones.',
    v_cupo_total, v_certs;
END IF;

FOR v_i IN 1..v_certs LOOP
  SELECT mes INTO v_mes
  FROM tmp_mf_mes
  WHERE asignados < cupo
  ORDER BY residuo_ars / (asignados + 1) DESC, mes
  LIMIT 1;

  UPDATE tmp_mf_mes SET asignados = asignados + 1 WHERE mes = v_mes;
END LOOP;

-- ---------------------------------------------------------------------------
-- 3.c  Que certificacion cae en que mes, contra que proyecto y con que estado
-- ---------------------------------------------------------------------------
-- El orden de las facturas dentro de la pata se toma del hash del id (sal
-- 3020), no del id, para que el bloque contiguo que recibe cada mes no quede
-- correlacionado con el numero de comprobante.
--
-- El proyecto se elige entre los que estaban abiertos ese mes, recorriendo la
-- lista en orden de hash: la certificacion numero r del mes toma el proyecto
-- r-esimo. Asi el reparto es parejo por construccion y ningun proyecto se lleva
-- dos certificaciones mientras otro no tenga ninguna.

DROP TABLE IF EXISTS tmp_mf_asig;
CREATE TEMP TABLE tmp_mf_asig AS
WITH pata AS (
  SELECT
    f.id,
    row_number() OVER (
      ORDER BY ((('x' || substr(md5(f.id::text || ':' || 3020::text), 1, 8))::bit(32)::int)::bigint
                + 2147483648), f.id) AS orden
  FROM gannet_demo.facturas f
  WHERE f.orden_trabajo_id IS NULL
    AND f.tipo_comprobante IN ('factura_a','factura_b','factura_c')
),
tramos AS (
  -- Cada mes se lleva un bloque contiguo de la lista ordenada por hash.
  SELECT
    m.mes, m.fin_mes, m.dias_mes, m.asignados,
    SUM(m.asignados) OVER (ORDER BY m.k ROWS UNBOUNDED PRECEDING) - m.asignados AS desde
  FROM tmp_mf_mes m
),
ubicada AS (
  SELECT
    p.id,
    t.mes,
    t.fin_mes,
    t.dias_mes,
    (p.orden - t.desde)::int AS r
  FROM pata p
  JOIN tramos t
    ON p.orden > t.desde AND p.orden <= t.desde + t.asignados
),
elegible AS (
  -- Proyectos abiertos en cada mes, en orden de hash del par (proyecto, mes).
  SELECT
    u.mes,
    pr.id AS proyecto_id,
    pr.cliente_id,
    COALESCE(pr.fecha_inicio_real, pr.fecha_inicio_plan) AS ini,
    row_number() OVER (
      PARTITION BY u.mes
      ORDER BY ((('x' || substr(md5(pr.id::text || ':' || u.mes::text || ':' || 3021::text), 1, 8))::bit(32)::int)::bigint
                + 2147483648), pr.id) AS n,
    COUNT(*) OVER (PARTITION BY u.mes) AS total
  FROM (SELECT DISTINCT mes, fin_mes FROM ubicada) u
  JOIN gannet_demo.proyectos pr
    ON pr.estado <> 'planificado'
   AND COALESCE(pr.fecha_inicio_real, pr.fecha_inicio_plan) <= u.fin_mes
   AND COALESCE(pr.fecha_fin_real, pr.fecha_fin_plan, DATE '9999-12-31') >= u.mes
)
SELECT
  u.id,
  u.mes,
  u.r,
  e.proyecto_id,
  e.cliente_id,
  -- La certificacion se emite dentro del mes, entre el dia 3 y el 28. Nunca
  -- antes del arranque del proyecto ni despues de hoy.
  LEAST(
    GREATEST(
      (u.mes + ((2 + ((((('x' || substr(md5(u.id::text || ':' || 3030::text), 1, 8))::bit(32)::int)::bigint
                        + 2147483648) % 26)::int)) || ' days')::interval)::date,
      e.ini),
    LEAST(u.fin_mes, CURRENT_DATE)
  ) AS emision
FROM ubicada u
JOIN elegible e
  ON e.mes = u.mes
 AND e.n = 1 + ((u.r - 1) % e.total);

CREATE UNIQUE INDEX ON tmp_mf_asig (id);

SELECT COUNT(*) INTO v_sin_mes
FROM gannet_demo.facturas f
WHERE f.orden_trabajo_id IS NULL
  AND f.tipo_comprobante IN ('factura_a','factura_b','factura_c')
  AND NOT EXISTS (SELECT 1 FROM tmp_mf_asig a WHERE a.id = f.id);

IF v_sin_mes > 0 THEN
  RAISE EXCEPTION '% certificaciones quedaron sin mes asignado.', v_sin_mes;
END IF;

-- Fecha, imputacion y cobranza en un solo UPDATE. `estado` y `fecha_cobro`
-- tienen que moverse juntos: la tabla exige que `cobrada` y `fecha_cobro` sean
-- equivalentes, y separarlos en dos sentencias viola el CHECK en la primera.
--
-- Las reglas de cobranza son las del generador, con las mismas sales: 2020
-- decide el estado, 2010 el diferimiento del cobro, y el cliente moroso sigue
-- concentrando el 88 por ciento de sus comprobantes vencidos en 'vencida'.
UPDATE gannet_demo.facturas f
SET proyecto_id       = a.proyecto_id,
    cliente_id        = a.cliente_id,
    cotizacion_id     = cot.id,
    fecha_emision     = a.emision,
    fecha_vencimiento = (a.emision + COALESCE(cl.condicion_pago_dias, 30))::date,
    estado            = s.estado,
    -- COBRANZA PEGADA AL VENCIMIENTO, NO REPARTIDA AL AZAR DESPUES DE LA EMISION
    --
    --   El generador difiere el cobro un numero uniforme de dias entre 3 y el
    --   plazo mas veinte. Con plazo de 30 dias eso es una ventana de casi dos
    --   meses, asi que la cobranza de un mes se parte entre dos o tres meses
    --   siguientes en proporciones que dependen del sorteo. Sobre ~30
    --   comprobantes por mes el resultado es una linea de cobrado que salta
    --   mas de un 100 por ciento de un mes al otro por debajo de una curva de
    --   emitido suave — y dos series de la misma factura que no se parecen en
    --   nada se leen como un error del sistema, no como estacionalidad.
    --
    --   Un cliente que paga, paga cerca del vencimiento. Concentrar el cobro
    --   en una banda de tres semanas alrededor del vencimiento hace que la
    --   cobranza de cada mes sea, de hecho, la facturacion de los meses
    --   anteriores desplazada — que es lo que la linea verde tiene que contar.
    --
    --   No toca en absoluto QUE comprobantes se cobran: los porcentajes de
    --   morosidad sembrados y revisados quedan intactos. Solo cambia CUANDO.
    fecha_cobro       = CASE
                          WHEN s.estado <> 'cobrada' THEN NULL
                          WHEN (a.emision + COALESCE(cl.condicion_pago_dias, 30)) < CURRENT_DATE
                            THEN LEAST(
                                   GREATEST(
                                     a.emision + COALESCE(cl.condicion_pago_dias, 30)
                                       + (((('x' || substr(md5(f.id::text || ':' || 2010::text), 1, 8))::bit(32)::int)::bigint
                                           + 2147483648) % 21)::int - 7,
                                     a.emision + 2),
                                   CURRENT_DATE)
                          -- Todavia no vencida y ya cobrada: pago adelantado,
                          -- repartido entre la emision y hoy.
                          ELSE LEAST(
                                 a.emision + 2
                                   + (((('x' || substr(md5(f.id::text || ':' || 2010::text), 1, 8))::bit(32)::int)::bigint
                                       + 2147483648) % GREATEST(CURRENT_DATE - a.emision - 1, 1))::int,
                                 CURRENT_DATE)
                        END,
    creado_en         = a.emision::timestamptz + INTERVAL '11 hours'
FROM tmp_mf_asig a
JOIN gannet_demo.clientes cl ON cl.id = a.cliente_id
CROSS JOIN LATERAL (
  SELECT CASE
    -- Misma regla que 3.0: pasado el limite de mora el comprobante ya no puede
    -- seguir figurando vencido.
    WHEN (a.emision + COALESCE(cl.condicion_pago_dias, 30)) < CURRENT_DATE - v_mora THEN
      CASE WHEN ((('x' || substr(md5(a.id::text || ':' || 3070::text), 1, 8))::bit(32)::int)::bigint
                 + 2147483648) % 100 < 80 THEN 'cobrada' ELSE 'anulada' END
    WHEN (a.emision + COALESCE(cl.condicion_pago_dias, 30)) < CURRENT_DATE THEN
      CASE
        WHEN cl.estado = 'moroso' THEN
          CASE WHEN ((('x' || substr(md5(a.id::text || ':' || 2020::text), 1, 8))::bit(32)::int)::bigint
                     + 2147483648) % 100 < 88 THEN 'vencida' ELSE 'cobrada' END
        WHEN ((('x' || substr(md5(a.id::text || ':' || 2020::text), 1, 8))::bit(32)::int)::bigint
              + 2147483648) % 100 < 79 THEN 'cobrada'
        WHEN ((('x' || substr(md5(a.id::text || ':' || 2020::text), 1, 8))::bit(32)::int)::bigint
              + 2147483648) % 100 < 97 THEN 'vencida'
        ELSE 'anulada'
      END
    ELSE
      CASE
        WHEN ((('x' || substr(md5(a.id::text || ':' || 2020::text), 1, 8))::bit(32)::int)::bigint
              + 2147483648) % 100 < 40 THEN 'cobrada'
        WHEN ((('x' || substr(md5(a.id::text || ':' || 2020::text), 1, 8))::bit(32)::int)::bigint
              + 2147483648) % 100 < 82 THEN 'enviada'
        ELSE 'emitida'
      END
  END AS estado
) s
LEFT JOIN LATERAL (
  SELECT c.id FROM gannet_demo.cotizaciones c
  WHERE c.proyecto_id = a.proyecto_id AND c.estado = 'aceptada'
  ORDER BY c.id LIMIT 1
) cot ON true
WHERE f.id = a.id;

-- ---------------------------------------------------------------------------
-- 3.d  Importes: el residuo del mes repartido entre sus certificaciones vivas
-- ---------------------------------------------------------------------------
-- El peso por comprobante vive en [0,62 , 1,38]: sin el, todas las
-- certificaciones de un mes saldrian por el mismo importe y la grilla de
-- /facturacion se leeria generada. Con el, el total del mes sigue cayendo
-- exacto sobre el objetivo porque el reparto es por peso relativo.

WITH vivas AS (
  SELECT
    f.id,
    a.mes,
    0.620 + (((('x' || substr(md5(f.id::text || ':' || 3040::text), 1, 8))::bit(32)::int)::bigint
              + 2147483648) % 761)::numeric / 1000 AS peso
  FROM gannet_demo.facturas f
  JOIN tmp_mf_asig a ON a.id = f.id
  WHERE f.estado <> 'anulada'
),
reparto AS (
  SELECT
    v.id,
    round(m.residuo_ars / 1.21 * v.peso
          / SUM(v.peso) OVER (PARTITION BY v.mes), 2) AS neto
  FROM vivas v
  JOIN tmp_mf_mes m ON m.mes = v.mes
)
UPDATE gannet_demo.facturas f
SET neto_ars  = r.neto,
    iva_ars   = round(r.neto * 0.21, 2),
    total_ars = round(r.neto, 2) + round(r.neto * 0.21, 2)
FROM reparto r
WHERE f.id = r.id;

-- Las anuladas no entran en el grafico ni en ningun KPI, pero se ven en la
-- grilla. Se les da un importe del rango corriente para que no queden en cero.
UPDATE gannet_demo.facturas f
SET neto_ars  = x.neto,
    iva_ars   = round(x.neto * 0.21, 2),
    total_ars = round(x.neto, 2) + round(x.neto * 0.21, 2)
FROM (
  SELECT
    f2.id,
    round(28000000::numeric
          + (((('x' || substr(md5(f2.id::text || ':' || 3050::text), 1, 8))::bit(32)::int)::bigint
              + 2147483648) % 262000001)::numeric, 2) AS neto
  FROM gannet_demo.facturas f2
  JOIN tmp_mf_asig a ON a.id = f2.id
  WHERE f2.estado = 'anulada'
) x
WHERE f.id = x.id;

-- ---------------------------------------------------------------------------
-- 3.e  Ritmo de cobranza — la segunda linea del mismo grafico
-- ---------------------------------------------------------------------------
-- El grafico dibuja emitido Y cobrado. Arreglar solo el emitido deja una linea
-- verde saltando mas de un cuarenta por ciento de un mes al otro por debajo de
-- una linea azul suave, y dos series de la misma factura que no se parecen en
-- nada se leen como un error del sistema.
--
-- POR QUE SALTA. La cobranza de un mes es la suma de unos treinta comprobantes
-- de doscientos y pico de millones cada uno. Basta que cinco caigan un mes mas
-- tarde para mover el total un cuarenta por ciento. No es un defecto del sorteo
-- del generador: es que el mes de cobro de cada comprobante se decidia sin
-- mirar nunca el total del mes, igual que pasaba con el emitido.
--
-- QUE SE HACE. Se fija un objetivo de cobranza por mes como convolucion del
-- emitido con un perfil de pago (8% en el mes, 42% al mes siguiente, 32% al
-- segundo, 18% al tercero), se lo escala para que sume exactamente lo que hay
-- cobrado, y se asigna a cada comprobante el mes que menos lleno esta dentro de
-- su ventana factible.
--
-- QUE NO SE TOCA. Que comprobantes estan cobrados y cuales no. El conjunto de
-- 'cobrada', 'vencida', 'enviada' y 'emitida' queda exactamente como quedo en
-- 3.c, con los porcentajes de morosidad sembrados y revisados intactos. Aca
-- solo se decide CUANDO paga el que ya paga.
--
-- VENTANA FACTIBLE. Un comprobante no puede cobrarse antes de emitirse ni
-- despues de hoy, y se le permiten como maximo cuatro meses de atraso: sin ese
-- techo el algoritmo empujaria comprobantes recientes a rellenar meses viejos y
-- aparecerian cobranzas a un anio del vencimiento junto a facturas al dia.

DROP TABLE IF EXISTS tmp_mf_cob;
CREATE TEMP TABLE tmp_mf_cob AS
WITH emitido AS (
  SELECT
    m.k, m.mes, m.fin_mes, m.dias_mes,
    COALESCE((SELECT SUM(f.total_ars) FROM gannet_demo.facturas f
              WHERE f.estado <> 'anulada'
                AND f.fecha_emision BETWEEN m.mes AND m.fin_mes), 0) AS emitido_ars
  FROM tmp_mf_mes m
),
perfil AS (
  SELECT
    e.k, e.mes, e.fin_mes, e.dias_mes,
    0.08 * e.emitido_ars
      + 0.42 * COALESCE(e1.emitido_ars, 0)
      + 0.32 * COALESCE(e2.emitido_ars, 0)
      + 0.18 * COALESCE(e3.emitido_ars, 0) AS bruto
  FROM emitido e
  LEFT JOIN emitido e1 ON e1.k = e.k - 1
  LEFT JOIN emitido e2 ON e2.k = e.k - 2
  LEFT JOIN emitido e3 ON e3.k = e.k - 3
)
SELECT k, mes, fin_mes, dias_mes, GREATEST(bruto, 1) AS objetivo, 0::numeric AS asignado
FROM perfil;

CREATE UNIQUE INDEX ON tmp_mf_cob (k);

-- Comprobantes cobrados emitidos dentro de la ventana modelada, del mas nuevo
-- al mas viejo. El orden fija el recorrido del algoritmo, asi que lleva el id
-- como desempate para no depender del plan del motor.
--
-- DEL MAS NUEVO AL MAS VIEJO, Y NO AL REVES. Un comprobante emitido este mes
-- solo puede cobrarse este mes; uno de hace un anio elige entre cinco. Si se
-- recorre de viejo a nuevo, los viejos se reparten comodos por toda la ventana
-- y los ultimos meses quedan como unico destino posible de todo lo reciente:
-- la cobranza del cierre se dispara por encima de lo emitido, que es
-- literalmente imposible y se ve en el grafico como la linea verde cruzando
-- por arriba de la azul. Colocando primero lo mas restringido, los ultimos
-- meses se llenan hasta su objetivo y lo viejo ocupa lo que queda.
DROP TABLE IF EXISTS tmp_mf_pago;
CREATE TEMP TABLE tmp_mf_pago AS
SELECT
  f.id,
  f.fecha_emision,
  f.total_ars,
  m.k AS k_emision,
  -- Cobros que llegaron pasado el limite de mora (los que resuelve 3.0 y su
  -- gemelo dentro de 3.c). No se les aplica el techo de cuatro meses de atraso:
  -- son, por definicion, cobros muy tardios, y encerrarlos cerca de su emision
  -- los amontona en el arranque de la ventana hasta hacer que la cobranza de
  -- esos meses supere a la facturacion.
  (f.fecha_vencimiento < CURRENT_DATE - v_mora) AS tardio,
  row_number() OVER (ORDER BY f.fecha_emision DESC, f.id DESC) AS orden,
  NULL::int AS k_cobro
FROM gannet_demo.facturas f
JOIN tmp_mf_cob m ON f.fecha_emision BETWEEN m.mes AND m.fin_mes
WHERE f.estado = 'cobrada';

CREATE UNIQUE INDEX ON tmp_mf_pago (orden);

-- El objetivo se escala para que sume exactamente lo cobrado que se va a
-- repartir. Sin esto el perfil describiria la forma correcta sobre un total
-- equivocado y la brecha entre emitido y cobrado dejaria de cerrar.
UPDATE tmp_mf_cob c
SET objetivo = c.objetivo
             * (SELECT SUM(total_ars) FROM tmp_mf_pago)
             / (SELECT SUM(objetivo) FROM tmp_mf_cob);

FOR v_i IN 1..(SELECT COUNT(*) FROM tmp_mf_pago) LOOP
  UPDATE tmp_mf_pago p
  SET k_cobro = (
    SELECT c.k
    FROM tmp_mf_cob c
    WHERE c.k >= p.k_emision
      AND c.k <= p.k_emision + CASE WHEN p.tardio THEN 999 ELSE 4 END
    -- El mes menos lleno EN PROPORCION a su objetivo, no el de mayor faltante
    -- absoluto: la tendencia hace que los meses nuevos tengan siempre el
    -- faltante absoluto mas grande, y por faltante absoluto todo comprobante
    -- se iria al ultimo mes de su ventana.
    ORDER BY (c.objetivo - c.asignado) / c.objetivo DESC, c.k
    LIMIT 1)
  WHERE p.orden = v_i;

  UPDATE tmp_mf_cob c
  SET asignado = c.asignado + p.total_ars
  FROM tmp_mf_pago p
  WHERE p.orden = v_i AND c.k = p.k_cobro;
END LOOP;

-- Dia del mes por hash, nunca antes de la emision ni despues de hoy.
UPDATE gannet_demo.facturas f
SET fecha_cobro = LEAST(
      GREATEST(
        (c.mes + ((((('x' || substr(md5(f.id::text || ':' || 3060::text), 1, 8))::bit(32)::int)::bigint
                    + 2147483648) % c.dias_mes)::int || ' days')::interval)::date,
        f.fecha_emision + 1),
      CURRENT_DATE)
FROM tmp_mf_pago p
JOIN tmp_mf_cob c ON c.k = p.k_cobro
WHERE f.id = p.id;

DROP TABLE IF EXISTS tmp_mf_pago;
DROP TABLE IF EXISTS tmp_mf_cob;
DROP TABLE IF EXISTS tmp_mf_asig;
DROP TABLE IF EXISTS tmp_mf_mes;

END;
$fn$;

COMMENT ON FUNCTION gannet_demo.aplicar_modelo_facturacion() IS
  'Reescribe la pata de certificaciones de gannet_demo.facturas para que el total emitido de cada mes caiga sobre el modelo de gannet_demo.modelo_facturacion y su perfil estacional. No toca las facturas originadas en orden de trabajo ni las notas de credito y debito. Deterministica e idempotente: cada decision sale de md5 sobre el id de la fila mas una sal fija.';

-- =============================================================================
-- 4. Se aplica sobre los datos ya sembrados, si los hay
-- =============================================================================
-- Esta migracion corre en dos escenarios y tiene que servir a los dos:
--
--   * sobre el VPS, con las 980 facturas ya sembradas — aca la funcion tiene
--     que ejecutarse y dejar la curva armada;
--   * en el arranque local desde cero, donde las migraciones corren ANTES que
--     el generador y `gannet_demo.facturas` todavia esta vacia — aca no hay
--     nada que modelar, y el generador llama a la funcion el mismo en su bloque
--     25.c, con sus propias aserciones.
--
-- Sin esta guarda el arranque desde cero aborta contra una serie vacia, que es
-- justamente el camino del que depende el plan B del congreso.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM gannet_demo.facturas) THEN
    PERFORM gannet_demo.aplicar_modelo_facturacion();
  END IF;
END $$;

-- =============================================================================
-- 5. public.gd_facturacion_mensual — la ventana pasa a ser de meses CERRADOS
-- =============================================================================
-- EL MES EN CURSO NO ENTRA EN LA CURVA, Y ESA ES LA DECISION
--
--   La alternativa era dibujarlo con trazo punteado y una etiqueta "parcial".
--   No sobrevive a un proyector. A esa distancia el ojo lee la FORMA de la
--   linea, no el estilo del trazo: un pozo del cuarenta por ciento en el
--   extremo derecho se lee como una caida por mas punteado que este, y la
--   leyenda que lo explica no la lee nadie en una charla de tres minutos.
--
--   La otra alternativa era dibujar el mes en curso proyectado a fin de mes.
--   Es peor: la tarjeta "Facturacion del mes" de la misma pantalla muestra el
--   acumulado real a hoy. Dos numeros distintos para julio en la misma pantalla
--   es exactamente la contradiccion que no puede pasar.
--
--   Asi que la serie del grafico son dieciocho meses CERRADOS. Es ademas como
--   lo hace cualquier tablero contable serio, y le da al presentador una
--   respuesta que suma en vez de restar si alguien pregunta por que la curva
--   termina en junio: porque julio todavia no cerro, y el numero de julio esta
--   en la tarjeta de al lado.
--
--   El mes en curso sigue viniendo en la vista, como fila final marcada con
--   `es_mes_parcial`. Nada que ya consumia la vista pierde datos, y el grafico
--   la descarta. Las tres columnas se agregan AL FINAL para que esto sea un
--   CREATE OR REPLACE y no un DROP: una vista de `public` recreada renace
--   escribible por `anon` por el ALTER DEFAULT PRIVILEGES de este proyecto.
-- =============================================================================

CREATE OR REPLACE VIEW public.gd_facturacion_mensual AS
WITH meses AS (
  SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - INTERVAL '18 months',
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
        / NULLIF(COALESCE(e.emitido_ars, 0), 0), 1)            AS cobrado_sobre_emitido_pct,
  (m.mes = date_trunc('month', CURRENT_DATE)::date)            AS es_mes_parcial,
  CASE WHEN m.mes = date_trunc('month', CURRENT_DATE)::date
       THEN EXTRACT(day FROM CURRENT_DATE)::int
       ELSE EXTRACT(day FROM (m.mes + INTERVAL '1 month' - INTERVAL '1 day'))::int
  END                                                          AS dias_facturados,
  EXTRACT(day FROM (m.mes + INTERVAL '1 month' - INTERVAL '1 day'))::int
                                                               AS dias_del_mes
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
  'Serie temporal mensual con el monto emitido y el cobrado, su brecha y el porcentaje cobrado sobre emitido. Trae los ultimos dieciocho meses CERRADOS mas el mes en curso, que viene marcado con es_mes_parcial y no se dibuja en la curva porque solo lleva facturados parte de sus dias. Alimenta el grafico principal de evolucion de ingresos. Los meses sin movimiento aparecen igualmente con valor cero para que la serie no tenga huecos.';

-- El ALTER DEFAULT PRIVILEGES de este proyecto otorga ALL sobre toda tabla
-- nueva de `public` a anon, authenticated y service_role, y un GRANT SELECT
-- posterior no revierte nada. Este bloque se corre aunque arriba haya un
-- CREATE OR REPLACE y no un DROP: cuesta nada y cubre el caso de que alguien
-- convierta este replace en un drop mas adelante.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.gd_facturacion_mensual FROM anon, authenticated;
GRANT SELECT ON public.gd_facturacion_mensual TO anon, authenticated;

-- =============================================================================
-- 6. ASERCION DE DETERMINISMO
-- =============================================================================
-- La expresion md5 escrita en linea en la funcion tiene que devolver lo mismo
-- que `gannet_demo.sem_h`, que es lo que ejecuta el generador. La funcion solo
-- existe mientras el generador corre, asi que se compara contra su definicion
-- reconstruida aca.
-- =============================================================================

DO $$
DECLARE
  i        bigint;
  sal      bigint;
  inline   bigint;
  esperado bigint;
BEGIN
  FOREACH sal IN ARRAY ARRAY[2010::bigint, 2020::bigint, 3010::bigint, 3020::bigint,
                             3021::bigint, 3030::bigint, 3040::bigint, 3050::bigint] LOOP
    FOR i IN 1..250 LOOP
      inline := ((('x' || substr(md5(i::text || ':' || sal::text), 1, 8))::bit(32)::int)::bigint
                 + 2147483648);
      esperado := (('x' || substr(md5(i::text || ':' || sal::text), 1, 8))::bit(32)::int)::bigint
                  + 2147483648;
      IF inline IS DISTINCT FROM esperado THEN
        RAISE EXCEPTION 'La expresion en linea difiere de sem_h(%, %): % vs %.',
          i, sal, inline, esperado;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- =============================================================================
-- 7. ASERCIONES DE COHERENCIA DE LA SERIE
-- =============================================================================
-- Lo que se acaba de arreglar tiene que quedar arreglado. Estas aserciones
-- fallan el despliegue antes que servir en el congreso una curva rota.
-- =============================================================================

DO $$
DECLARE
  r        record;
  v_ratio  numeric;
  v_peor   numeric;
BEGIN
  -- En el arranque desde cero no hay nada que comprobar todavia: las
  -- aserciones equivalentes las corre el generador en su bloque 25.c, una vez
  -- que existen los comprobantes.
  IF NOT EXISTS (SELECT 1 FROM gannet_demo.facturas) THEN
    RETURN;
  END IF;

  -- 7.a  Ningun mes cerrado de la ventana puede quedar vacio ni marginal.
  FOR r IN
    SELECT periodo, emitido_ars
    FROM public.gd_facturacion_mensual
    WHERE NOT es_mes_parcial AND emitido_ars < 1000000000
  LOOP
    RAISE EXCEPTION 'El mes % emitio solo % — la ventana arranca con un mes marginal.',
      r.periodo, r.emitido_ars;
  END LOOP;

  -- 7.b  Amplitud de la serie: una empresa no factura 100 a 1 entre dos meses.
  SELECT MAX(emitido_ars) / NULLIF(MIN(emitido_ars), 0) INTO v_ratio
  FROM public.gd_facturacion_mensual WHERE NOT es_mes_parcial;

  IF v_ratio > 3 THEN
    RAISE EXCEPTION 'La serie tiene un maximo sobre minimo de % a 1.', round(v_ratio, 1);
  END IF;

  -- 7.c  Variacion mes contra mes: nada de saltos de mas de un tercio.
  SELECT MAX(ABS(v)) INTO v_peor FROM (
    SELECT emitido_ars / NULLIF(LAG(emitido_ars) OVER (ORDER BY mes), 0) - 1 AS v
    FROM public.gd_facturacion_mensual WHERE NOT es_mes_parcial
  ) d;

  IF v_peor > 0.34 THEN
    RAISE EXCEPTION 'La serie tiene una variacion mensual de % por ciento.', round(v_peor * 100, 1);
  END IF;

  -- 7.d  La linea de cobrado tiene que acompaniar a la de emitido, no pelearse
  -- con ella. Un mes puntual puede cobrar mas de lo que facturo — enero cobra
  -- lo de diciembre — pero no de forma sistematica ni por mucho.
  SELECT MAX(cobrado_ars / NULLIF(emitido_ars, 0)) INTO v_ratio
  FROM public.gd_facturacion_mensual WHERE NOT es_mes_parcial;

  IF v_ratio > 1.25 THEN
    RAISE EXCEPTION 'Hay un mes que cobro % veces lo que emitio.', round(v_ratio, 2);
  END IF;

  IF (SELECT COUNT(*) FROM public.gd_facturacion_mensual
      WHERE NOT es_mes_parcial AND cobrado_ars > emitido_ars) > 2 THEN
    RAISE EXCEPTION 'La linea de cobrado cruza por encima de la de emitido en mas de dos meses.';
  END IF;

  SELECT MAX(ABS(v)) INTO v_peor FROM (
    SELECT cobrado_ars / NULLIF(LAG(cobrado_ars) OVER (ORDER BY mes), 0) - 1 AS v
    FROM public.gd_facturacion_mensual WHERE NOT es_mes_parcial
  ) d;

  IF v_peor > 0.80 THEN
    RAISE EXCEPTION 'La cobranza tiene una variacion mensual de % por ciento.', round(v_peor * 100, 1);
  END IF;

  -- 7.e  Ninguna mora ancestral. El tramo mas alto del informe de antiguedad
  -- de la demo es "mas de 90 dias"; un vencido de mas de un anio se sale de la
  -- escala del propio tablero que lo muestra.
  IF EXISTS (
    SELECT 1 FROM gannet_demo.facturas f
    CROSS JOIN gannet_demo.modelo_facturacion m
    WHERE f.estado = 'vencida' AND f.fecha_vencimiento < CURRENT_DATE - m.dias_mora_maxima
  ) THEN
    RAISE EXCEPTION 'Quedaron comprobantes vencidos pasado el limite de mora.';
  END IF;

  -- 7.f  Las dos pantallas que dicen "Cobranza vencida" tienen que decir el
  -- mismo numero. El panel ejecutivo suma por estado; el informe de antiguedad
  -- clasifica por fecha sobre la poblacion pendiente. Coinciden solo si ningun
  -- comprobante pendiente esta vencido de hecho sin estarlo de estado.
  IF EXISTS (
    SELECT 1 FROM gannet_demo.facturas
    WHERE estado IN ('emitida','enviada')
      AND fecha_vencimiento < CURRENT_DATE
  ) THEN
    RAISE EXCEPTION
      'Hay comprobantes pendientes vencidos de hecho pero no de estado: el panel y el informe de antiguedad van a mostrar cobranzas vencidas distintas.';
  END IF;

  -- 7.g  El mes en curso queda fuera de la curva pero sigue estando.
  IF (SELECT COUNT(*) FROM public.gd_facturacion_mensual WHERE es_mes_parcial) <> 1 THEN
    RAISE EXCEPTION 'La vista no trae exactamente un mes en curso.';
  END IF;

  IF (SELECT COUNT(*) FROM public.gd_facturacion_mensual WHERE NOT es_mes_parcial) <> 18 THEN
    RAISE EXCEPTION 'La vista no trae exactamente dieciocho meses cerrados.';
  END IF;

  -- 7.h  Nada emitido en el futuro ni cobrado antes de emitido.
  IF EXISTS (SELECT 1 FROM gannet_demo.facturas
             WHERE fecha_emision > CURRENT_DATE OR fecha_cobro > CURRENT_DATE) THEN
    RAISE EXCEPTION 'Hay comprobantes con fecha futura.';
  END IF;
END $$;

-- =============================================================================
-- 8. ASERCIONES DE PRIVILEGIOS
-- =============================================================================
-- Esta migracion toca una vista de `public`. El agujero de ALTER DEFAULT
-- PRIVILEGES ya se abrio una vez en este proyecto, asi que la auditoria corre
-- entera y aborta el despliegue si alguna vista quedo escribible.
-- =============================================================================

DO $$
DECLARE
  r record;
BEGIN
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

  -- Las tablas nuevas del modelo viven en `gannet_demo` y no se exponen.
  FOR r IN
    SELECT c.relname, rol
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    CROSS JOIN unnest(ARRAY['anon','authenticated']) AS rol
    WHERE n.nspname = 'gannet_demo'
      AND c.relkind IN ('r', 'v')
      AND has_table_privilege(rol, c.oid, 'SELECT')
  LOOP
    RAISE EXCEPTION 'La relacion gannet_demo.% es legible por el rol %.', r.relname, r.rol;
  END LOOP;

  -- La demo corre sin sesion: `anon` no puede perder SELECT sobre el grafico.
  IF NOT has_table_privilege('anon', 'public.gd_facturacion_mensual', 'SELECT') THEN
    RAISE EXCEPTION 'anon perdio SELECT sobre public.gd_facturacion_mensual.';
  END IF;
END $$;

COMMIT;

-- PostgREST cachea el esquema. Sin esto, las tres columnas nuevas de la vista
-- no llegan a la aplicacion hasta el proximo reinicio.
NOTIFY pgrst, 'reload schema';
