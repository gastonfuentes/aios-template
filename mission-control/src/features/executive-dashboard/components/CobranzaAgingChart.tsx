'use client'

/**
 * Receivables aging rolled up to its five buckets.
 *
 * `gd_cobranzas_aging` is stored per client *and* per bucket; the board needs it
 * per bucket, so the rollup happens here rather than in a second view.
 *
 * This is the one chart that carries a color ramp, because the buckets have an
 * order — corriente, 1-30, 31-60, 61-90, +90 — and light-to-dark is the encoding
 * that shows it. It is a sequential ramp on one hue, not five categorical hues.
 * Every bar is directly labeled, so the ramp never has to be decoded.
 */

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts'
import { AGING_BUCKET, describe } from '@/features/gannet/labels'
import { formatArsCompact } from '@/features/gannet/format'
import type { CobranzaAging } from '@/features/gannet/types'
import { agingRamp, useChartPalette } from './chartPalette'
import {
  ChartCard,
  ChartTooltip,
  axisLine,
  axisTick,
  niceMax,
  niceTicks,
  toPlainNumber,
} from './chartPrimitives'

const BAR_SIZE = 24
const BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]

type AgingBucket = {
  readonly tramo: string
  readonly etiqueta: string
  readonly orden: number
  readonly monto_ars: number
}

/** Collapses the per-client rows into one row per bucket, ordered corriente -> +90. */
function rollUpByBucket(rows: readonly CobranzaAging[]): AgingBucket[] {
  const totals = new Map<string, { orden: number; etiqueta: string; monto_ars: number }>()
  for (const row of rows) {
    const current = totals.get(row.tramo) ?? {
      orden: row.orden_tramo ?? 0,
      etiqueta: row.etiqueta_tramo ?? describe(AGING_BUCKET, row.tramo).label,
      monto_ars: 0,
    }
    current.monto_ars += row.monto_ars ?? 0
    totals.set(row.tramo, current)
  }
  return [...totals.entries()]
    .map(([tramo, value]) => ({ tramo, ...value }))
    .sort((a, b) => a.orden - b.orden)
}

export function CobranzaAgingChart({ rows }: { rows: readonly CobranzaAging[] }) {
  const palette = useChartPalette()
  const buckets = useMemo(() => rollUpByBucket(rows), [rows])
  const ramp = agingRamp(palette)

  const peak = buckets.reduce((max, bucket) => Math.max(max, bucket.monto_ars), 0)
  const ticks = niceTicks(peak, 4)
  const upperBound = niceMax(peak, 4)

  return (
    <ChartCard
      title="Antigüedad de la deuda"
      description="Saldo pendiente distribuido por tramo de mora."
      height={280}
    >
      <BarChart data={buckets} margin={{ top: 24, right: 8, bottom: 4, left: 4 }} barCategoryGap="30%">
        <CartesianGrid stroke={palette.separator} strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="etiqueta"
          tick={axisTick(palette.labelSecondary)}
          tickLine={false}
          axisLine={axisLine(palette.separator)}
          interval={0}
          minTickGap={0}
        />
        <YAxis
          type="number"
          domain={[0, upperBound]}
          ticks={ticks}
          tickFormatter={(value: number) => formatArsCompact(value)}
          tick={axisTick(palette.labelTertiary)}
          tickLine={false}
          axisLine={false}
          width={72}
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
          dataKey="monto_ars"
          name="Saldo"
          barSize={BAR_SIZE}
          radius={BAR_RADIUS}
          isAnimationActive={false}
        >
          {buckets.map((bucket, index) => (
            <Cell key={bucket.tramo} fill={ramp[index] ?? ramp[ramp.length - 1]} />
          ))}
          <LabelList
            dataKey="monto_ars"
            position="top"
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
