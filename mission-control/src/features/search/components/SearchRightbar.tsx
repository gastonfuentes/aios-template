'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  X,
  Clock,
  MessageCircle,
  Bot,
  Activity,
  PenSquare,
  CheckSquare,
  CalendarClock,
  Brain,
} from 'lucide-react'
import { Modal } from '@/core/components/macos/Modal'
import {
  SOURCE_LABELS,
  SOURCE_ORDER,
  type SearchResponse,
  type SearchResult,
  type SearchSourceKey,
} from '../types'
import { useRecentSearches } from '../hooks/useRecentSearches'

const DEBOUNCE_MS = 220

// Icono canónico por fuente — refuerza la legibilidad del rightbar.
const SOURCE_ICONS: Record<SearchSourceKey, typeof Search> = {
  chat_sessions: MessageCircle,
  chat_messages: Bot,
  ops_events: Activity,
  tasks: CheckSquare,
  draw_canvases: PenSquare,
  scheduled_tasks: CalendarClock,
  agent_memories: Brain,
}

export function SearchRightbar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const router = useRouter()
  const { recent, addRecent, removeRecent, clearAll } = useRecentSearches()

  // Auto-focus input al abrir.
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // Wrap onClose para resetear el query del rightbar — al re-abrir mostrará
  // siempre las búsquedas recientes desde cero (UX canónica macOS Spotlight).
  // Si el query >= 2 chars al cerrar, primero lo guardamos en recientes para
  // que el operador pueda re-disparar la búsqueda sin re-escribir.
  const handleClose = useCallback(() => {
    if (query.trim().length >= 2) addRecent(query)
    setQuery('')
    setResponse(null)
    onClose()
  }, [query, addRecent, onClose])

  const runSearch = useCallback(async (q: string, ac: AbortController) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: ac.signal,
      })
      if (!res.ok) return
      const body = (await res.json()) as SearchResponse
      if (!ac.signal.aborted) setResponse(body)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [])

  // Trigger fetch debounced cuando query cambia.
  useEffect(() => {
    if (!open) return
    if (query.trim().length < 2) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const handle = setTimeout(() => {
      void runSearch(query, ac)
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(handle)
      ac.abort()
    }
  }, [query, open, runSearch])

  // Derive: cuando query < 2 chars, response visible es null.
  const visibleResponse = query.trim().length < 2 ? null : response

  // Flatten results para keyboard navigation con índice global.
  const flatResults = useMemo<SearchResult[]>(() => {
    if (!visibleResponse) return []
    const out: SearchResult[] = []
    for (const key of SOURCE_ORDER) {
      out.push(...(visibleResponse.groups[key] ?? []))
    }
    return out
  }, [visibleResponse])

  // Clamp safeActiveIndex al rango actual de resultados — derived, no setState
  // in effect (regla canónica Praxis). El reset a 0 se hace en handlers que
  // cambian el query/visibility.
  const safeActiveIndex =
    flatResults.length === 0 ? 0 : Math.min(activeIndex, flatResults.length - 1)

  // Mantener el safeActiveIndex item visible scroll-wise.
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(
      `[data-result-index="${safeActiveIndex}"]`,
    ) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [safeActiveIndex])

  function commitNavigation(result: SearchResult) {
    if (query.trim().length >= 2) addRecent(query)
    setQuery('')
    setResponse(null)
    onClose()
    router.push(result.href)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && flatResults.length > 0) {
      event.preventDefault()
      setActiveIndex((i) => (i + 1) % flatResults.length)
    } else if (event.key === 'ArrowUp' && flatResults.length > 0) {
      event.preventDefault()
      setActiveIndex(
        (i) => (i - 1 + flatResults.length) % flatResults.length,
      )
    } else if (event.key === 'Enter' && flatResults.length > 0) {
      event.preventDefault()
      const target = flatResults[safeActiveIndex] ?? flatResults[0]
      if (target) commitNavigation(target)
    }
  }

  const totalResults =
    visibleResponse &&
    SOURCE_ORDER.reduce(
      (acc, k) => acc + (visibleResponse.groups[k]?.length ?? 0),
      0,
    )

  return (
    <Modal
      open={open}
      onClose={handleClose}
      label="Búsqueda federada"
      placement="sheet-right"
      panelMaxWidth="480px"
      panelClassName="flex flex-col"
    >
      <header
        className="hairline-b flex items-center gap-2 p-4"
        style={{ background: 'var(--material-thin-light)' }}
      >
        <Search
          size={14}
          strokeWidth={2}
          style={{ color: 'var(--label-tertiary)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar conversaciones, eventos, dibujos, memorias…"
          aria-label="Buscar en todo el sistema"
          aria-autocomplete="list"
          aria-controls="search-results-list"
          className="flex-1 bg-transparent text-body outline-none placeholder:text-[color:var(--label-tertiary)]"
          style={{ color: 'var(--label-primary)' }}
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Clear query"
            className="mc-interactive inline-flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--label-tertiary)] hover:bg-[color:var(--fill-secondary)]"
          >
            <X size={11} strokeWidth={2} />
          </button>
        )}
        <kbd
          aria-hidden
          className="hidden rounded px-1.5 py-0.5 font-mono text-[10px] sm:inline-block"
          style={{
            background: 'var(--fill-secondary)',
            color: 'var(--label-tertiary)',
          }}
        >
          esc
        </kbd>
      </header>

      <div
        ref={listRef}
        id="search-results-list"
        role="listbox"
        className="flex-1 overflow-auto px-3 py-3"
      >
        {query.trim().length < 2 && (
          <RecentSearches
            recent={recent}
            onPick={(q) => {
              setQuery(q)
              inputRef.current?.focus()
            }}
            onRemove={removeRecent}
            onClearAll={clearAll}
          />
        )}

        {query.trim().length >= 2 && loading && !visibleResponse && (
          <SearchSkeleton />
        )}

        {visibleResponse && totalResults === 0 && (
          <EmptyState query={query} />
        )}

        {visibleResponse &&
          (() => {
            let globalIndex = 0
            return SOURCE_ORDER.map((key) => {
              const items = visibleResponse.groups[key] ?? []
              if (items.length === 0) return null
              return (
                <section key={key} className="mb-4">
                  <header
                    className="mb-1.5 flex items-center justify-between px-2 text-caption2 uppercase tracking-wide"
                    style={{ color: 'var(--label-tertiary)' }}
                  >
                    <span>{SOURCE_LABELS[key]}</span>
                    <span>{items.length}</span>
                  </header>
                  <div className="flex flex-col gap-0.5">
                    {items.map((r) => {
                      const idx = globalIndex++
                      return (
                        <ResultRow
                          key={`${key}-${r.id}`}
                          result={r}
                          query={query}
                          index={idx}
                          active={idx === safeActiveIndex}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onNavigate={() => commitNavigation(r)}
                        />
                      )
                    })}
                  </div>
                </section>
              )
            })
          })()}
      </div>

      <footer
        className="hairline-t flex items-center justify-between gap-3 px-4 py-2 text-caption2"
        style={{
          background: 'var(--material-thin-light)',
          color: 'var(--label-tertiary)',
        }}
      >
        <span className="flex items-center gap-3">
          <KbdHint chord="↑↓">navegar</KbdHint>
          <KbdHint chord="↵">abrir</KbdHint>
          <KbdHint chord="esc">cerrar</KbdHint>
        </span>
        {visibleResponse && totalResults !== null && totalResults > 0 && (
          <span>{totalResults} resultados</span>
        )}
      </footer>
    </Modal>
  )
}

// ───────────────────────────────────────────────────────────────────────────

function RecentSearches({
  recent,
  onPick,
  onRemove,
  onClearAll,
}: {
  recent: readonly string[]
  onPick: (query: string) => void
  onRemove: (query: string) => void
  onClearAll: () => void
}) {
  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-12 text-center">
        <Clock
          size={20}
          strokeWidth={1.6}
          style={{ color: 'var(--label-tertiary)' }}
        />
        <p className="text-callout" style={{ color: 'var(--label-secondary)' }}>
          Sin búsquedas recientes
        </p>
        <p className="max-w-xs text-callout normal-case" style={{ color: 'var(--label-tertiary)' }}>
          Empieza a escribir para buscar en conversaciones, eventos, dibujos
          y memorias.
        </p>
      </div>
    )
  }

  return (
    <section>
      <header className="mb-2 flex items-center justify-between px-2 text-caption2 uppercase tracking-wide" style={{ color: 'var(--label-tertiary)' }}>
        <span className="flex items-center gap-1.5">
          <Clock size={11} strokeWidth={2} />
          Búsquedas recientes
        </span>
        <button
          type="button"
          onClick={onClearAll}
          className="mc-interactive rounded px-1.5 py-0.5 text-caption2 normal-case hover:bg-[color:var(--fill-secondary)]"
          style={{ color: 'var(--accent)' }}
        >
          Limpiar
        </button>
      </header>
      <div className="flex flex-col gap-0.5">
        {recent.map((q, idx) => (
          <div
            key={q}
            className="group flex items-center gap-1"
            style={{
              animation: `mc-overlay-in 220ms cubic-bezier(0,0,0.2,1) ${idx * 16}ms both`,
            }}
          >
            <button
              type="button"
              onClick={() => onPick(q)}
              className="mc-interactive flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[color:var(--fill-secondary)]"
            >
              <Clock
                size={11}
                strokeWidth={1.8}
                style={{ color: 'var(--label-tertiary)' }}
              />
              <span
                className="truncate text-callout"
                style={{ color: 'var(--label-primary)' }}
              >
                {q}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove(q)
              }}
              aria-label={`Quitar ${q} de búsquedas recientes`}
              className="mc-interactive inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[color:var(--label-tertiary)] opacity-0 hover:bg-[color:var(--fill-secondary)] hover:text-[color:var(--label-primary)] group-hover:opacity-100"
            >
              <X size={10} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse flex-col gap-1.5 rounded-md p-2"
          style={{
            background: 'var(--fill-secondary)',
            animationDelay: `${i * 60}ms`,
          }}
        >
          <span
            aria-hidden
            className="block h-3 w-1/3 rounded"
            style={{ background: 'var(--fill-primary)' }}
          />
          <span
            aria-hidden
            className="block h-2.5 w-3/4 rounded"
            style={{ background: 'var(--fill-primary)' }}
          />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-2 py-12 text-center">
      <Search
        size={20}
        strokeWidth={1.6}
        style={{ color: 'var(--label-tertiary)' }}
      />
      <p className="text-callout" style={{ color: 'var(--label-secondary)' }}>
        Sin resultados para “{query}”
      </p>
      <p className="text-callout normal-case" style={{ color: 'var(--label-tertiary)' }}>
        Probá con otras palabras o un fragmento más corto.
      </p>
    </div>
  )
}

function ResultRow({
  result,
  query,
  index,
  active,
  onMouseEnter,
  onNavigate,
}: {
  result: SearchResult
  query: string
  index: number
  active: boolean
  onMouseEnter: () => void
  onNavigate: () => void
}) {
  const Icon = SOURCE_ICONS[result.source]

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      data-result-index={index}
      onClick={onNavigate}
      onMouseEnter={onMouseEnter}
      className="mc-interactive flex items-start gap-2 rounded-md px-2 py-2 text-left"
      style={{
        background: active ? 'var(--fill-secondary)' : 'transparent',
      }}
    >
      <Icon
        size={13}
        strokeWidth={1.8}
        className="mt-0.5 shrink-0"
        style={{
          color: active ? 'var(--accent)' : 'var(--label-tertiary)',
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-callout"
          style={{ color: 'var(--label-primary)' }}
        >
          {highlightMatch(result.title, query)}
        </span>
        {result.preview && (
          <span
            className="line-clamp-2 text-callout normal-case"
            style={{ color: 'var(--label-tertiary)', fontSize: '11px', lineHeight: '14px' }}
          >
            {highlightMatch(result.preview, query)}
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * Resalta el término de búsqueda en el texto. Case-insensitive, regex-safe.
 * Retorna ReactNode con `<mark>` styling tokens del DS.
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (q.length < 2) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark
        key={i}
        style={{
          background: 'rgba(10, 132, 255, 0.18)',
          color: 'var(--accent)',
          borderRadius: '3px',
          padding: '0 2px',
        }}
      >
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

function KbdHint({ chord, children }: { chord: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <kbd
        className="rounded px-1.5 py-0.5 font-mono text-[10px]"
        style={{
          background: 'var(--fill-secondary)',
          color: 'var(--label-tertiary)',
        }}
      >
        {chord}
      </kbd>
      <span>{children}</span>
    </span>
  )
}
