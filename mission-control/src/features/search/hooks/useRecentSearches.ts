'use client'

import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'aios-recent-searches'
const MAX_RECENT = 8

/**
 * PRP-034 iter post-cierre: hook de búsquedas recientes para Search rightbar.
 *
 * Persiste un array de strings en `localStorage` (cap 8, FIFO al exceder, dedup
 * case-insensitive). Sigue el patrón canónico Praxis `useSyncExternalStore` +
 * singleton listeners (PRP-020/023/031) — cero `setState` in effect, SSR
 * retorna `[]`, cliente rehidrata con localStorage en next paint.
 *
 * Cross-tab sync vía `storage` event nativo del browser.
 */

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  listeners.add(callback)
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) emit()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

// Cache estable para evitar `getSnapshot should be cached` warning de React.
// Se invalida cuando hace storage write o cuando llega storage event cross-tab.
let cachedSnapshot: readonly string[] = []
let cachedSnapshotKey = ''

function getSnapshot(): readonly string[] {
  if (typeof window === 'undefined') return cachedSnapshot
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? '[]'
    if (raw === cachedSnapshotKey) return cachedSnapshot
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      cachedSnapshotKey = raw
      cachedSnapshot = parsed.filter((s): s is string => typeof s === 'string')
    } else {
      cachedSnapshotKey = raw
      cachedSnapshot = []
    }
    return cachedSnapshot
  } catch {
    return cachedSnapshot
  }
}

function getServerSnapshot(): readonly string[] {
  return cachedSnapshot
}

function writeRecent(items: readonly string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
  // Invalidar cache para que el siguiente getSnapshot retorne fresh.
  cachedSnapshotKey = ''
  emit()
}

export type UseRecentSearchesReturn = {
  recent: readonly string[]
  addRecent: (query: string) => void
  removeRecent: (query: string) => void
  clearAll: () => void
}

export function useRecentSearches(): UseRecentSearchesReturn {
  const recent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addRecent = useCallback((query: string) => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return
    const current = getSnapshot()
    // Dedup case-insensitive — mueve la entrada al top si ya existe.
    const filtered = current.filter(
      (q) => q.toLowerCase() !== trimmed.toLowerCase(),
    )
    const next = [trimmed, ...filtered].slice(0, MAX_RECENT)
    writeRecent(next)
  }, [])

  const removeRecent = useCallback((query: string) => {
    const current = getSnapshot()
    writeRecent(current.filter((q) => q !== query))
  }, [])

  const clearAll = useCallback(() => {
    writeRecent([])
  }, [])

  return { recent, addRecent, removeRecent, clearAll }
}
