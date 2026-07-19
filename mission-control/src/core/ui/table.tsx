'use client'

/**
 * DataTable — reusable, sortable, searchable, paginated table for Mission Control.
 *
 * Built for the Gannet demo grids, which range from 6 rows (funnel summaries) to
 * 1,350 rows (work orders). Rendering 1,350 DOM rows at once is wasteful and
 * janky on a stage laptop, so the table paginates client-side: sorting and
 * searching run over the full dataset, but only one page is rendered.
 *
 * Deliberately not virtualized. Pagination gives the presenter a stable, easily
 * narrated surface ("page 1 of 54") and avoids a scroll-position dependency
 * during a live demo. Virtualization would buy nothing at these row counts once
 * only a page is mounted.
 *
 * Styling follows the MC conventions: `mc-card` surfaces, `rounded-card` /
 * `rounded-control` radii, iOS type scale, colors via CSS custom properties.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from 'lucide-react'

/** Value a column contributes to sorting. `null` always sorts last. */
export type SortValue = string | number | boolean | null | undefined

export type Column<T> = {
  /** Stable identifier — also the sort key. */
  readonly key: string
  readonly header: string
  readonly align?: 'left' | 'right' | 'center'
  /** Inline width hint, e.g. `'12rem'`. Omit to let the column auto-size. */
  readonly width?: string
  /** Cell content. */
  readonly render: (row: T) => ReactNode
  /** Comparable value. Omit to make the column non-sortable. */
  readonly sortValue?: (row: T) => SortValue
  /** Text matched by the search box. Omit to exclude the column from search. */
  readonly searchValue?: (row: T) => string | null | undefined
  /** Hide the column below this breakpoint to keep narrow viewports readable. */
  readonly hideBelow?: 'sm' | 'md' | 'lg' | 'xl'
}

export type SortState = {
  readonly key: string
  readonly direction: 'asc' | 'desc'
}

export type DataTableProps<T> = {
  readonly rows: readonly T[]
  readonly columns: readonly Column<T>[]
  readonly getRowId: (row: T, index: number) => string
  readonly loading?: boolean
  readonly error?: string | null
  /** Sort applied before the user touches any header. */
  readonly initialSort?: SortState
  readonly pageSize?: number
  readonly searchPlaceholder?: string
  /** Shown when there are no rows at all. */
  readonly emptyMessage?: string
  /** Shown when a search or filter removed every row. */
  readonly noResultsMessage?: string
  readonly onRowClick?: (row: T) => void
  /** Accent applied to a whole row — used to flag overdue / critical records. */
  readonly rowAccent?: (row: T) => string | null | undefined
  /** Extra controls rendered in the toolbar, to the right of the search box. */
  readonly toolbar?: ReactNode
  /** Hides the search box for small summary tables where it adds only noise. */
  readonly searchable?: boolean
}

const HIDE_BELOW_CLASS: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
}

const ALIGN_CLASS = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
} as const

/**
 * Null-last, type-aware comparison. Numbers compare numerically, everything else
 * compares as locale-aware text so accented Spanish names order correctly.
 */
function compareValues(a: SortValue, b: SortValue): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), 'es-AR', { numeric: true, sensitivity: 'base' })
}

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  loading = false,
  error = null,
  initialSort,
  pageSize = 25,
  searchPlaceholder = 'Buscar…',
  emptyMessage = 'No hay registros para mostrar.',
  noResultsMessage = 'Ningún registro coincide con la búsqueda.',
  onRowClick,
  rowAccent,
  toolbar,
  searchable = true,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null)
  const [page, setPage] = useState(0)

  const searchableColumns = useMemo(
    () => columns.filter((column) => column.searchValue !== undefined),
    [columns],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('es-AR')
    if (!needle || searchableColumns.length === 0) return rows
    return rows.filter((row) =>
      searchableColumns.some((column) =>
        (column.searchValue?.(row) ?? '').toLocaleLowerCase('es-AR').includes(needle),
      ),
    )
  }, [rows, query, searchableColumns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const column = columns.find((candidate) => candidate.key === sort.key)
    if (!column?.sortValue) return filtered
    const factor = sort.direction === 'asc' ? 1 : -1
    // `filtered` may be the caller's array; copy before sorting in place.
    return [...filtered].sort((a, b) => factor * compareValues(column.sortValue!(a), column.sortValue!(b)))
  }, [filtered, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  // Clamped during render rather than corrected by an effect: a shrinking result
  // set should land on the last valid page instead of throwing the presenter
  // back to page 1, and the pager already steps from `safePage`, so the stored
  // `page` never needs to be written back.
  const safePage = Math.min(page, pageCount - 1)

  const visible = useMemo(
    () => sorted.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [sorted, safePage, pageSize],
  )

  const toggleSort = useCallback((column: Column<T>) => {
    if (!column.sortValue) return
    setSort((current) => {
      if (current?.key !== column.key) return { key: column.key, direction: 'asc' }
      if (current.direction === 'asc') return { key: column.key, direction: 'desc' }
      return null
    })
  }, [])

  const onSearchChange = useCallback((value: string) => {
    setQuery(value)
    setPage(0)
  }, [])

  const showToolbar = searchable || toolbar !== undefined

  return (
    <section className="mc-card flex min-h-0 flex-col rounded-card">
      {showToolbar && (
        <header
          className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--separator)' }}
        >
          {searchable && (
            <label className="relative flex min-w-0 flex-1 items-center">
              <Search
                size={14}
                strokeWidth={2}
                aria-hidden
                className="pointer-events-none absolute left-2.5"
                style={{ color: 'var(--label-tertiary)' }}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="mc-interactive-soft w-full rounded-control py-1.5 pl-8 pr-3 text-callout outline-none"
                style={{
                  background: 'var(--fill-secondary)',
                  color: 'var(--label-primary)',
                }}
              />
            </label>
          )}
          {toolbar}
          <span
            className="shrink-0 text-caption1 tabular-nums"
            style={{ color: 'var(--label-tertiary)' }}
          >
            {sorted.length.toLocaleString('es-AR')}
            {sorted.length === rows.length ? '' : ` de ${rows.length.toLocaleString('es-AR')}`}{' '}
            {sorted.length === 1 ? 'registro' : 'registros'}
          </span>
        </header>
      )}

      {error ? (
        <p className="px-4 py-12 text-center text-callout" style={{ color: 'var(--sys-red)' }}>
          {error}
        </p>
      ) : loading && rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-callout" style={{ color: 'var(--label-tertiary)' }}>
          Cargando información…
        </p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-12 text-center text-callout" style={{ color: 'var(--label-tertiary)' }}>
          {emptyMessage}
        </p>
      ) : visible.length === 0 ? (
        <p className="px-4 py-12 text-center text-callout" style={{ color: 'var(--label-tertiary)' }}>
          {noResultsMessage}
        </p>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full border-collapse text-callout">
            <thead>
              <tr>
                {columns.map((column) => {
                  const isSorted = sort?.key === column.key
                  const sortable = column.sortValue !== undefined
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                      className={[
                        'whitespace-nowrap border-b px-3 py-2 text-caption1 font-medium',
                        ALIGN_CLASS[column.align ?? 'left'],
                        column.hideBelow ? HIDE_BELOW_CLASS[column.hideBelow] : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        borderColor: 'var(--separator)',
                        color: 'var(--label-secondary)',
                        width: column.width,
                      }}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className={[
                            'mc-interactive-soft inline-flex items-center gap-1 rounded-control px-1 py-0.5',
                            column.align === 'right' ? 'flex-row-reverse' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={{ color: isSorted ? 'var(--label-primary)' : 'inherit' }}
                        >
                          {column.header}
                          {isSorted ? (
                            sort.direction === 'asc' ? (
                              <ArrowUp size={11} strokeWidth={2.5} aria-hidden />
                            ) : (
                              <ArrowDown size={11} strokeWidth={2.5} aria-hidden />
                            )
                          ) : (
                            <ChevronsUpDown size={11} strokeWidth={2} aria-hidden className="opacity-40" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const accent = rowAccent?.(row)
                const clickable = onRowClick !== undefined
                return (
                  <tr
                    key={getRowId(row, safePage * pageSize + index)}
                    onClick={clickable ? () => onRowClick(row) : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    role={clickable ? 'button' : undefined}
                    onKeyDown={
                      clickable
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onRowClick(row)
                            }
                          }
                        : undefined
                    }
                    className={clickable ? 'mc-interactive-soft cursor-pointer' : undefined}
                    style={{
                      borderLeft: accent ? `2px solid ${accent}` : '2px solid transparent',
                      background: accent ? `color-mix(in oklab, ${accent} 7%, transparent)` : undefined,
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={[
                          'border-t px-3 py-2 align-middle',
                          ALIGN_CLASS[column.align ?? 'left'],
                          column.hideBelow ? HIDE_BELOW_CLASS[column.hideBelow] : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ borderColor: 'var(--separator)', color: 'var(--label-primary)' }}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && !error && (
        <footer
          className="flex items-center justify-between gap-3 border-t px-4 py-2.5"
          style={{ borderColor: 'var(--separator)' }}
        >
          <span className="text-caption1 tabular-nums" style={{ color: 'var(--label-tertiary)' }}>
            Página {safePage + 1} de {pageCount}
          </span>
          <div className="flex items-center gap-1.5">
            <PageButton
              label="Página anterior"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft size={14} strokeWidth={2} aria-hidden />
            </PageButton>
            <PageButton
              label="Página siguiente"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight size={14} strokeWidth={2} aria-hidden />
            </PageButton>
          </div>
        </footer>
      )}
    </section>
  )
}

function PageButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="mc-interactive inline-flex h-7 w-7 items-center justify-center rounded-control"
      style={{ background: 'var(--fill-secondary)', color: 'var(--label-primary)' }}
    >
      {children}
    </button>
  )
}
