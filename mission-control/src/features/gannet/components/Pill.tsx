'use client'

/**
 * Pill — compact tinted label for states, priorities and flags.
 *
 * Uses `color-mix` against the tone color for the background so the tint tracks
 * the active theme, matching the treatment already used by the rubro chips in
 * `/proveedores`.
 */

import type { ReactNode } from 'react'
import { TONE_COLOR, type Tone } from '../tone'

export function Pill({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  tone?: Tone
  title?: string
}) {
  const color = TONE_COLOR[tone]
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-control px-1.5 py-0.5 text-caption2"
      style={{
        background: `color-mix(in oklab, ${color} 16%, transparent)`,
        color,
      }}
    >
      {children}
    </span>
  )
}

/**
 * Small solid dot — used where a full pill would crowd the row but the state
 * still needs to be visible at a glance.
 */
export function Dot({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span
      aria-label={label}
      title={label}
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: TONE_COLOR[tone] }}
    />
  )
}
