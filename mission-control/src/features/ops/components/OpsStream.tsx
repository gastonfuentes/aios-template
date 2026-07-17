'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useOpsStream } from '../hooks/useOpsStream'
import { OpsEventCard } from './OpsEventCard'
import { OpsFilterBar, type OpsFilters } from './OpsFilterBar'
import type { OpsEvent, OpsEventType, OpsSource } from '../types'

export function OpsStream() {
  const { events, connected, error, clear } = useOpsStream()
  const [filters, setFilters] = useState<OpsFilters>({
    typesSelected: new Set<OpsEventType>(),
    sourcesSelected: new Set<OpsSource>(),
    query: '',
    autoScroll: true,
  })
  const [paused, setPaused] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Derive tool duration map: tool_start.id → ms desde tool_done con mismo
  // toolId en data.
  const durations = useMemo(() => {
    const map = new Map<string, number>()
    const starts = new Map<string, number>()
    for (const e of events) {
      if (e.type === 'tool_start' && typeof e.data['toolId'] === 'string') {
        starts.set(e.data['toolId'], e.timestamp)
      } else if (
        (e.type === 'tool_done' || e.type === 'tool_error') &&
        typeof e.data['toolId'] === 'string'
      ) {
        const start = starts.get(e.data['toolId'])
        if (start !== undefined) {
          map.set(e.id, e.timestamp - start)
        }
      }
    }
    return map
  }, [events])

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (filters.typesSelected.size > 0 && !filters.typesSelected.has(e.type)) return false
      if (filters.sourcesSelected.size > 0 && !filters.sourcesSelected.has(e.source)) return false
      if (filters.query) {
        const haystack =
          `${e.type} ${e.source} ${JSON.stringify(e.data)}`.toLowerCase()
        if (!haystack.includes(filters.query.toLowerCase())) return false
      }
      return true
    })
  }, [events, filters])

  // Auto-scroll al bottom cuando el toggle está ON y el operador no está
  // hovereando. PRP-031 canónico: cero setState in effect.
  useEffect(() => {
    if (!filters.autoScroll || paused) return
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [filtered, filters.autoScroll, paused])

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3 px-6 py-6">
      <OpsFilterBar
        filters={filters}
        onChange={setFilters}
        connected={connected}
        onClear={clear}
      />

      {error && !connected && (
        <p className="text-callout" style={{ color: 'var(--sys-orange)' }}>
          {error}
        </p>
      )}

      <div
        ref={listRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="flex-1 overflow-auto"
      >
        {filtered.length === 0 && (
          <p
            className="py-12 text-center text-callout"
            style={{ color: 'var(--label-tertiary)' }}
          >
            {events.length === 0
              ? 'Esperando primer evento del daemon…'
              : 'Ningún evento coincide con los filtros.'}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          {filtered.map((e) => (
            <OpsEventCard
              key={e.id}
              event={e}
              toolDuration={durations.get(e.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Re-export for page consumers — minimal API surface.
export type { OpsEvent }
