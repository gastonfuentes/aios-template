'use client'

/**
 * Chart palette resolution for the executive dashboard.
 *
 * The colors live in `dashboard-charts.css` as CSS custom properties scoped to
 * `.gd-charts`, but Recharts writes `stroke` / `fill` as SVG presentation
 * attributes, and `var()` inside a presentation attribute is not reliably
 * substituted across browsers. So the provider mounts the scope element, reads
 * the computed values off it once per theme, and hands plain hex/rgba strings
 * down through context.
 *
 * Resolving from the live element rather than from a duplicated TypeScript map
 * keeps the stylesheet the single source of truth, and picks up the existing
 * Mission Control tokens (`--separator`, `--label-*`) for free.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTheme } from 'next-themes'
import './dashboard-charts.css'

/** CSS custom property backing each palette slot. */
const TOKENS = {
  series1: '--gd-series-1',
  series2: '--gd-series-2',
  magnitude: '--gd-magnitude',
  aging1: '--gd-aging-1',
  aging2: '--gd-aging-2',
  aging3: '--gd-aging-3',
  aging4: '--gd-aging-4',
  aging5: '--gd-aging-5',
  separator: '--separator',
  labelSecondary: '--label-secondary',
  labelTertiary: '--label-tertiary',
} as const

export type ChartPalette = Record<keyof typeof TOKENS, string>

/**
 * Light-mode values, used for the first paint and on the server. The effect
 * overwrites them with the computed values one frame later, so a dark-mode
 * viewer never sees these for a perceptible amount of time.
 */
const FALLBACK: ChartPalette = {
  series1: '#007aff',
  series2: '#28cd41',
  magnitude: '#007aff',
  aging1: '#86b6ef',
  aging2: '#5598e7',
  aging3: '#2a78d6',
  aging4: '#1c5cab',
  aging5: '#104281',
  separator: 'rgba(0, 0, 0, 0.10)',
  labelSecondary: 'rgba(60, 60, 67, 0.60)',
  labelTertiary: 'rgba(60, 60, 67, 0.30)',
}

const ChartPaletteContext = createContext<ChartPalette>(FALLBACK)

export function useChartPalette(): ChartPalette {
  return useContext(ChartPaletteContext)
}

/** The five aging steps as an ordered array, corriente -> +90. */
export function agingRamp(palette: ChartPalette): readonly string[] {
  return [palette.aging1, palette.aging2, palette.aging3, palette.aging4, palette.aging5]
}

function readPalette(element: HTMLElement): ChartPalette {
  const computed = getComputedStyle(element)
  const entries = Object.entries(TOKENS).map(([slot, property]) => {
    const value = computed.getPropertyValue(property).trim()
    return [slot, value === '' ? FALLBACK[slot as keyof ChartPalette] : value]
  })
  return Object.fromEntries(entries) as ChartPalette
}

/**
 * Renders the `.gd-charts` scope element and publishes the resolved palette.
 * Wrap the whole dashboard once; every chart below reads from context.
 */
export function ChartPaletteProvider({ children }: { children: ReactNode }) {
  const scopeRef = useRef<HTMLDivElement>(null)
  const [palette, setPalette] = useState<ChartPalette>(FALLBACK)
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const element = scopeRef.current
    if (element === null) return
    setPalette(readPalette(element))
  }, [resolvedTheme])

  const value = useMemo(() => palette, [palette])

  return (
    <div ref={scopeRef} className="gd-charts flex min-w-0 flex-col gap-5">
      <ChartPaletteContext.Provider value={value}>{children}</ChartPaletteContext.Provider>
    </div>
  )
}
