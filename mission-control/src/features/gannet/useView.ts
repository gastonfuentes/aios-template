'use client'

/**
 * Client hooks for reading the demo views through `/api/gannet/<view>`.
 *
 * `useView` fetches one view. `useViews2` fetches two in parallel, which is the
 * shape almost every module needs (a detail grid plus an aggregate summary) and
 * saves each module from re-implementing the same loading/error bookkeeping.
 *
 * There is no polling: the demo data is a static seed, so a refresh button plus
 * the initial load is enough. `/proveedores` polls every ten seconds because it
 * demonstrates live file ingestion; these modules have no such story.
 */

import { useCallback, useEffect, useState } from 'react'
import type { GannetViewName } from './views'

export type ViewState<T> = {
  readonly rows: T[]
  readonly loading: boolean
  readonly error: string | null
  readonly reload: () => void
}

type ApiResponse<T> = {
  rows?: T[]
  error?: string
}

const GENERIC_ERROR = 'No se pudo cargar la información.'

function buildUrl(view: GannetViewName, params?: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return `/api/gannet/${view}${query ? `?${query}` : ''}`
}

async function fetchView<T>(url: string, signal: AbortSignal): Promise<T[]> {
  const res = await fetch(url, { cache: 'no-store', signal })
  const json = (await res.json()) as ApiResponse<T>
  if (!res.ok || json.error) throw new Error(json.error ?? GENERIC_ERROR)
  return json.rows ?? []
}

/**
 * Reads a single view.
 *
 * `params` is serialized into the URL and used as the effect dependency, so
 * callers may pass an inline object literal without causing a refetch loop.
 * Pass `enabled: false` to defer the request (e.g. a detail view waiting for a
 * selected id).
 */
export function useView<T>(
  view: GannetViewName,
  options?: {
    params?: Record<string, string | number | undefined>
    enabled?: boolean
  },
): ViewState<T> {
  const url = buildUrl(view, options?.params)
  const enabled = options?.enabled ?? true

  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((current) => current + 1), [])

  // The request is deferred by a zero-delay timeout so no state is written
  // synchronously inside the effect body — the same pattern `/proveedores` uses
  // to satisfy `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      void (async () => {
        try {
          const data = await fetchView<T>(url, controller.signal)
          setRows(data)
          setError(null)
        } catch (cause) {
          if (controller.signal.aborted) return
          setError(cause instanceof Error ? cause.message : GENERIC_ERROR)
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      })()
    }, 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [url, enabled, nonce])

  // Disabled hooks report an idle, empty state without ever writing to it, so
  // toggling `enabled` needs no reset effect.
  if (!enabled) return { rows: [], loading: false, error: null, reload }

  return { rows, loading, error, reload }
}

export type TwoViewState<A, B> = {
  readonly primary: A[]
  readonly secondary: B[]
  readonly loading: boolean
  readonly error: string | null
  readonly reload: () => void
}

/**
 * Reads two views in parallel and surfaces a single loading/error pair.
 *
 * Both requests are issued together rather than sequentially — the views are
 * independent and each responds in single-digit milliseconds, so serializing
 * them would only add latency.
 */
export function useViews2<A, B>(primary: GannetViewName, secondary: GannetViewName): TwoViewState<A, B> {
  const primaryUrl = buildUrl(primary)
  const secondaryUrl = buildUrl(secondary)

  const [primaryRows, setPrimaryRows] = useState<A[]>([])
  const [secondaryRows, setSecondaryRows] = useState<B[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((current) => current + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      void (async () => {
        try {
          const [a, b] = await Promise.all([
            fetchView<A>(primaryUrl, controller.signal),
            fetchView<B>(secondaryUrl, controller.signal),
          ])
          setPrimaryRows(a)
          setSecondaryRows(b)
          setError(null)
        } catch (cause) {
          if (controller.signal.aborted) return
          setError(cause instanceof Error ? cause.message : GENERIC_ERROR)
        } finally {
          if (!controller.signal.aborted) setLoading(false)
        }
      })()
    }, 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [primaryUrl, secondaryUrl, nonce])

  return { primary: primaryRows, secondary: secondaryRows, loading, error, reload }
}
