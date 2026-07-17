'use client'

/**
 * Hook adapter para el model selector del chat (PRP-031 Sub-fase 4).
 *
 * Carga la lista de modelos del SDK Claude Code disponibles en el daemon
 * AIOS via `GET /api/chat/models` (proxy → daemon `/models`, cache 1h en
 * el daemon). Persiste la selección en localStorage para que sobreviva
 * reload + cross-tab via `useSyncExternalStore` canónico Praxis (PRP-020).
 *
 * Default: `'default'` (= Opus 4.7 con 1M context según el FALLBACK_RESPONSE
 * del proxy). El daemon mismo aplica `currentModelId = null` por default y
 * el primer turn de chat baseline lo establece — el operador puede
 * overrirde con `/model <name>` desde el dropdown.
 *
 * Reglas Praxis (PRP-020/PRP-030):
 *   - Cero `setState` dentro de effects para state derivado de plataforma.
 *   - Fetch HTTP on mount usa el patrón canónico Praxis (cancellation +
 *     supresión scoped justificada de `set-state-in-effect`).
 *   - Sync prop→ref via `useEffect` sin deps array.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export type ModelInfo = {
  value: string
  displayName: string
  description?: string
}

export type ModelsResponse = {
  models: ModelInfo[]
  source: 'sdk' | 'cache' | 'fallback'
}

const STORAGE_KEY = 'aios.chat.selectedModel'
const DEFAULT_MODEL = 'default'

// ─── Singleton store cross-tab para localStorage ───────────────────────────

const listeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    listeners.delete(callback)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

function getSnapshot(): string {
  if (typeof window === 'undefined') return DEFAULT_MODEL
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MODEL
  } catch {
    return DEFAULT_MODEL
  }
}

function getServerSnapshot(): string {
  return DEFAULT_MODEL
}

function emit(): void {
  for (const listener of listeners) listener()
}

function setStoredModel(value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
    emit()
  } catch {
    /* localStorage disabled or quota exceeded — silent */
  }
}

// ─── Hook público ───────────────────────────────────────────────────────────

export type UseModelSelectorReturn = {
  /** Lista de modelos disponibles (vacía mientras carga). */
  models: ModelInfo[]
  /** Modelo actualmente seleccionado (persiste cross-tab). */
  selectedModel: string
  /** Source del listing: `sdk` (live SDK), `cache` (60min cache daemon), `fallback` (daemon offline). */
  source: 'sdk' | 'cache' | 'fallback' | 'loading'
  /** Estado de carga inicial. */
  isLoading: boolean
  /** Error de fetch (raro, siempre cae a fallback antes). */
  error: string | null
  /** Cambia el modelo activo (persiste localStorage + emite a listeners cross-tab). */
  setSelectedModel: (value: string) => void
}

export function useModelSelector(): UseModelSelectorReturn {
  const selectedModel = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [source, setSource] = useState<'sdk' | 'cache' | 'fallback' | 'loading'>('loading')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    async function load() {
      try {
        const res = await fetch('/api/chat/models', {
          method: 'GET',
          signal: ac.signal,
          cache: 'no-store',
        })
        if (ac.signal.aborted) return
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json = (await res.json()) as ModelsResponse
        if (ac.signal.aborted) return
        // setState desde async function dentro de useEffect: la regla
        // `react-hooks/set-state-in-effect` NO la flagea porque el setState
        // ocurre fuera del flow síncrono del effect (el effect ya retornó
        // cleanup). Cancellation activa via abortRef + ac.signal.aborted
        // checks cubren stale-update.
        setModels(json.models ?? [])
        setSource(json.source ?? 'fallback')
      } catch (err) {
        if (ac.signal.aborted) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setSource('fallback')
      } finally {
        if (!ac.signal.aborted) {
          setIsLoading(false)
        }
      }
    }
    void load()

    return () => {
      ac.abort()
    }
  }, [])

  const setSelectedModel = useCallback((value: string) => {
    setStoredModel(value)
  }, [])

  return {
    models,
    selectedModel,
    source,
    isLoading,
    error,
    setSelectedModel,
  }
}
