'use client'

/**
 * Revenue by service line — ten horizontal bars, one hue.
 *
 * The view exposes a `color_hex` per service and this chart deliberately
 * ignores it. Ten hand-assigned hues fail every colorblind-safety threshold
 * once they are that close together, and they would re-encode with color the
 * one thing bar length already states perfectly: magnitude. Identity is on the
 * axis, where it belongs.
 *
 * No legend: a single series is named by the card title.
 */

import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { formatArsCompact } from '@/features/gannet/format'
import type { IngresoPorServicio } from '@/features/gannet/types'
import { useChartPalette } from './chartPalette'
import {
  ChartCard,
  ChartTooltip,
  axisLine,
  axisTick,
  niceMax,
  niceTicks,
  toPlainNumber,
} from './chartPrimitives'

/** Bars stay thin; 4px rounded at the data end, square at the baseline. */
const BAR_SIZE = 20
const BAR_RADIUS: [number, number, number, number] = [0, 4, 4, 0]

export function IngresosPorServicioChart({ rows }: { rows: readonly IngresoPorServicio[] }) {
  const palette = useChartPalette()

  const peak = rows.reduce((max, row) => Math.max(max, row.facturado_ars ?? 0), 0)
  const ticks = niceTicks(peak, 4)
  const upperBound = niceMax(peak, 4)

  return (
    <ChartCard
      title="Ingresos por línea de servicio"
      description="Monto facturado acumulado por cada una de las diez líneas de servicio."
      height={Math.max(240, rows.length * 34 + 48)}
    >
      <BarChart
        layout="vertical"
        data={[...rows]}
        margin={{ top: 4, right: 88, bottom: 4, left: 4 }}
        barCategoryGap="28%"
      >
        <CartesianGrid stroke={palette.separator} strokeWidth={1} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, upperBound]}
          ticks={ticks}
          tickFormatter={(value: number) => formatArsCompact(value)}
          tick={axisTick(palette.labelTertiary)}
          tickLine={false}
          axisLine={axisLine(palette.separator)}
        />
        <YAxis
          type="category"
          dataKey="servicio"
          tick={axisTick(palette.labelSecondary)}
          tickLine={false}
          axisLine={false}
          width={168}
        />
        <Tooltip
          cursor={{ fill: palette.separator }}
          content={(props) => (
            <ChartTooltip
              active={props.active}
              label={props.label}
              payload={props.payload}
              formatValue={formatArsCompact}
            />
          )}
        />
        <Bar
          dataKey="facturado_ars"
          name="Facturado"
          fill={palette.magnitude}
          barSize={BAR_SIZE}
          radius={BAR_RADIUS}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="facturado_ars"
            position="right"
            offset={8}
            formatter={(value) => formatArsCompact(toPlainNumber(value))}
            fill={palette.labelSecondary}
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartCard>
  )
}
