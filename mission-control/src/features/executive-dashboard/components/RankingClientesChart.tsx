'use client'

/**
 * Top clients by historical billing — and the entry point to the demo's
 * drill-down.
 *
 * Clicking a bar navigates to the work-orders module filtered to that client
 * (`/ordenes-trabajo?cliente=<cliente_id>`), which is the moment the board stops
 * being a poster and starts being a system. `gd_ot_operativas` declares
 * `cliente_id` in its `filters` array so the API route honours the query.
 *
 * Single hue, same blue as the other magnitude bars: the comparison is "how
 * much", not "which one". Hover raises the whole bar rectangle, which is a far
 * larger hit target than the value label beside it.
 */

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { formatArsCompact } from '@/features/gannet/format'
import type { RankingCliente } from '@/features/gannet/types'
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

/** Eight bars is the most a reader compares at a glance without a table. */
const TOP_COUNT = 8
const BAR_SIZE = 20
const BAR_RADIUS: [number, number, number, number] = [0, 4, 4, 0]

export function RankingClientesChart({ rows }: { rows: readonly RankingCliente[] }) {
  const router = useRouter()
  const palette = useChartPalette()
  const [hovered, setHovered] = useState<number | null>(null)

  // The view already arrives ordered by billing desc; slicing is enough.
  const top = rows.slice(0, TOP_COUNT)
  const peak = top.reduce((max, row) => Math.max(max, row.facturado_total_ars ?? 0), 0)
  const ticks = niceTicks(peak, 4)
  const upperBound = niceMax(peak, 4)

  const openClient = (index: number) => {
    const row = top[index]
    if (row === undefined) return
    router.push(`/ordenes-trabajo?cliente=${row.cliente_id}`)
  }

  return (
    <ChartCard
      title="Clientes por facturación"
      description="Los ocho primeros de la cartera. Tocá una barra para ver sus órdenes de trabajo."
      height={Math.max(240, top.length * 34 + 48)}
    >
      <BarChart
        layout="vertical"
        data={[...top]}
        margin={{ top: 4, right: 88, bottom: 4, left: 4 }}
        barCategoryGap="28%"
        className="gd-chart-clickable"
        onMouseLeave={() => setHovered(null)}
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
          dataKey="cliente"
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
          dataKey="facturado_total_ars"
          name="Facturado"
          barSize={BAR_SIZE}
          radius={BAR_RADIUS}
          isAnimationActive={false}
          onClick={(_entry, index) => openClient(index)}
        >
          {top.map((row, index) => (
            <Cell
              key={row.cliente_id}
              fill={palette.magnitude}
              fillOpacity={hovered === null || hovered === index ? 1 : 0.45}
              cursor="pointer"
              onMouseEnter={() => setHovered(index)}
            />
          ))}
          <LabelList
            dataKey="facturado_total_ars"
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
