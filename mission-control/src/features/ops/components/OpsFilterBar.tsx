'use client'

import { Search, X } from 'lucide-react'
import {
  ALL_SOURCES,
  ALL_TYPES,
  type OpsEventType,
  type OpsSource,
} from '../types'

export type OpsFilters = {
  typesSelected: Set<OpsEventType>
  sourcesSelected: Set<OpsSource>
  query: string
  autoScroll: boolean
}

export function OpsFilterBar({
  filters,
  onChange,
  connected,
  onClear,
}: {
  filters: OpsFilters
  onChange: (next: OpsFilters) => void
  connected: boolean
  onClear: () => void
}) {
  function toggleType(t: OpsEventType) {
    const next = new Set(filters.typesSelected)
    if (next.has(t)) next.delete(t)
    else next.add(t)
    onChange({ ...filters, typesSelected: next })
  }

  function toggleSource(s: OpsSource) {
    const next = new Set(filters.sourcesSelected)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    onChange({ ...filters, sourcesSelected: next })
  }

  return (
    <div className="mc-card rounded-card flex flex-col gap-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-caption2"
          style={{
            background: 'var(--fill-secondary)',
            color: 'var(--label-secondary)',
          }}
        >
          <Search size={11} strokeWidth={2} />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Buscar en payload…"
            className="w-48 bg-transparent outline-none placeholder:text-[color:var(--label-tertiary)]"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, query: '' })}
              aria-label="Clear query"
            >
              <X size={10} strokeWidth={2} />
            </button>
          )}
        </div>

        <label className="flex items-center gap-1.5 text-caption2" style={{ color: 'var(--label-secondary)' }}>
          <input
            type="checkbox"
            checked={filters.autoScroll}
            onChange={(e) => onChange({ ...filters, autoScroll: e.target.checked })}
          />
          Auto-scroll
        </label>

        <div className="ml-auto flex items-center gap-2 text-caption2" style={{ color: connected ? 'var(--sys-green)' : 'var(--sys-orange)' }}>
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: connected ? 'var(--sys-green)' : 'var(--sys-orange)' }}
          />
          {connected ? 'Live' : 'Reconectando…'}
        </div>

        <button
          type="button"
          onClick={onClear}
          className="mc-interactive rounded-md px-2 py-1 text-caption2 hover:bg-[color:var(--fill-secondary)]"
          style={{ color: 'var(--label-secondary)' }}
        >
          Limpiar
        </button>
      </div>

      <details>
        <summary className="cursor-pointer select-none text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          Filtros avanzados
        </summary>
        <div className="mt-2 flex flex-col gap-2 pl-1">
          <FilterGroup label="Source">
            {ALL_SOURCES.map((s) => (
              <FilterPill
                key={s}
                active={filters.sourcesSelected.has(s)}
                onClick={() => toggleSource(s)}
              >
                {s}
              </FilterPill>
            ))}
          </FilterGroup>
          <FilterGroup label="Type">
            {ALL_TYPES.map((t) => (
              <FilterPill
                key={t}
                active={filters.typesSelected.has(t)}
                onClick={() => toggleType(t)}
              >
                {t}
              </FilterPill>
            ))}
          </FilterGroup>
        </div>
      </details>
    </div>
  )
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
        {label}:
      </span>
      {children}
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mc-interactive rounded px-2 py-0.5 text-caption2 font-mono"
      style={{
        background: active ? 'var(--accent)' : 'var(--fill-secondary)',
        color: active ? 'white' : 'var(--label-secondary)',
      }}
    >
      {children}
    </button>
  )
}
