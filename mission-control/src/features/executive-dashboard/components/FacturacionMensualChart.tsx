'use client'

/**
 * Billing evolution — emitted vs. collected over the trailing 18 CLOSED months.
 *
 * ONE y axis. Both series are ARS on the same scale, so a second axis would
 * invent a relationship the data does not have; it is the single most common
 * way to lie with a line chart.
 *
 * Only the last point of each line carries a value label. A number on every
 * point turns a trend into a table and destroys the shape the chart exists to
 * show. Those two end labels are also the accessibility relief for the green
 * series, whose light-mode step sits under the 3:1 mark contrast minimum — they
 * are load-bearing, not decoration.
 *
 * THE MONTH IN PROGRESS IS NOT PLOTTED.
 *
 *   The view hands over eighteen closed months plus the current one, flagged
 *   with `es_mes_parcial`. On the day of the congress that flagged month has
 *   twenty of thirty-one days billed, so plotting it beside complete months
 *   drops the curve by a third at exactly the right-hand edge — the last thing
 *   the eye lands on in the opening chart.
 *
 *   Drawing it dashed does not fix it. At projector distance the eye reads the
 *   SHAPE of the line, not the style of the stroke, and nobody reads a legend
 *   during a three-minute pitch. Drawing it projected to month-end is worse:
 *   the "Facturación del mes" card on this same screen shows the real
 *   month-to-date figure, and two different numbers for July on one screen is
 *   precisely the contradiction that cannot happen.
 *
 *   So the curve is eighteen closed months, which is also how any serious
 *   accounting dashboard draws it, and the current month keeps its own card.
 *   The subtitle says so out loud, in one short line, so the presenter has an
 *   answer ready instead of a hole.
 */

import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LabelListEntry } from 'recharts'
import { formatArsCompact } from '@/features/gannet/format'
import type { FacturacionMensual } from '@/features/gannet/types'
import { useChartPalette } from './chartPalette'
import {
  ChartCard,
  ChartLegend,
  ChartTooltip,
  axisLine,
  axisTick,
  niceMax,
  niceTicks,
  toPlainNumber,
} from './chartPrimitives'

const SERIES_EMITTED = 'Emitido'
const SERIES_COLLECTED = 'Cobrado'

/**
 * `es_mes_parcial` is served by `public.gd_facturacion_mensual` but is not part
 * of the shared `FacturacionMensual` type, which another feature owns. It is
 * declared here as optional so this chart can drop the in-progress month
 * without reaching outside its own folder — and so that a database still on the
 * previous view shape degrades to plotting every row rather than nothing.
 */
type FilaFacturacionMensual = FacturacionMensual & {
  es_mes_parcial?: boolean | null
}

export function FacturacionMensualChart({ rows }: { rows: readonly FacturacionMensual[] }) {
  const palette = useChartPalette()

  const closedMonths = rows.filter(
    (row) => (row as FilaFacturacionMensual).es_mes_parcial !== true,
  )
  const lastIndex = closedMonths.length - 1

  const peak = closedMonths.reduce(
    (max, row) => Math.max(max, row.emitido_ars ?? 0, row.cobrado_ars ?? 0),
    0,
  )
  const ticks = niceTicks(peak)
  const upperBound = niceMax(peak)

  /** Labels the final point of a series and nothing else. */
  const endLabel = (entry: LabelListEntry, index: number) =>
    index === lastIndex ? formatArsCompact(toPlainNumber(entry.value)) : ''

  return (
    <ChartCard
      title="Evolución de facturación"
      description="Monto emitido y monto cobrado por mes, últimos 18 meses cerrados. El mes en curso se muestra aparte."
      height={260}
      legend={
        <ChartLegend
          items={[
            { label: SERIES_EMITTED, color: palette.series1 },
            { label: SERIES_COLLECTED, color: palette.series2 },
          ]}
        />
      }
    >
      <LineChart data={closedMonths} margin={{ top: 16, right: 72, bottom: 4, left: 4 }}>
        <CartesianGrid
          stroke={palette.separator}
          strokeWidth={1}
          vertical={false}
        />
        <XAxis
          dataKey="etiqueta"
          tick={axisTick(palette.labelTertiary)}
          tickLine={false}
          axisLine={axisLine(palette.separator)}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          type="number"
          domain={[0, upperBound]}
          ticks={ticks}
          tickFormatter={(value: number) => formatArsCompact(value)}
          tick={axisTick(palette.labelTertiary)}
          tickLine={false}
          axisLine={false}
          // Wide enough for "$ 10,0 mil M" on one line. At 72 the compact ARS
          // ticks wrapped, which reads as a rendering fault on a projector.
          width={92}
        />
        <Tooltip
          cursor={{ stroke: palette.separator, strokeWidth: 1 }}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              label={props.label}
              payload={props.payload}
              formatValue={formatArsCompact}
            />
          )}
        />
        <Line
          type="monotone"
          dataKey="emitido_ars"
          name={SERIES_EMITTED}
          stroke={palette.series1}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          isAnimationActive={false}
          dot={(props) =>
            props.index === lastIndex ? (
              <circle key="end" cx={props.cx} cy={props.cy} r={4.5} fill={palette.series1} />
            ) : null
          }
          activeDot={{ r: 5, strokeWidth: 0 }}
        >
          <LabelList
            valueAccessor={endLabel}
            position="right"
            offset={10}
            fill={palette.labelSecondary}
            fontSize={11}
          />
        </Line>
        <Line
          type="monotone"
          dataKey="cobrado_ars"
          name={SERIES_COLLECTED}
          stroke={palette.series2}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          isAnimationActive={false}
          dot={(props) =>
            props.index === lastIndex ? (
              <circle key="end" cx={props.cx} cy={props.cy} r={4.5} fill={palette.series2} />
            ) : null
          }
          activeDot={{ r: 5, strokeWidth: 0 }}
        >
          <LabelList
            valueAccessor={endLabel}
            position="right"
            offset={10}
            fill={palette.labelSecondary}
            fontSize={11}
          />
        </Line>
      </LineChart>
    </ChartCard>
  )
}
