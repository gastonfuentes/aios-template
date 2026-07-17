'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { SearchRightbar } from './SearchRightbar'
import { useSearchHotkey } from '../hooks/useSearchHotkey'

/**
 * PRP-034 Sub-fase 5: trigger del rightbar de búsqueda.
 *
 * Reemplaza el `<label>` placeholder de ToolbarSearch (PRP-020 dejado como
 * stub visual). Sumar al toolbar header y consumir `Cmd+K` global.
 */
export function SearchTrigger() {
  const [open, setOpen] = useState(false)
  useSearchHotkey(() => setOpen(true))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search (Cmd+K)"
        className="mc-interactive-soft inline-flex h-7 w-44 items-center gap-1.5 rounded-full px-3 hover:bg-[color:var(--fill-primary)]"
        style={{
          background: 'var(--fill-secondary)',
          color: 'var(--label-tertiary)',
        }}
      >
        <Search size={12} strokeWidth={2.2} />
        <span className="flex-1 text-left text-body">Search</span>
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px]"
          style={{
            background: 'var(--fill-primary)',
            color: 'var(--label-tertiary)',
          }}
        >
          ⌘K
        </span>
      </button>
      <SearchRightbar open={open} onClose={() => setOpen(false)} />
    </>
  )
}
