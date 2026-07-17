'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OpsEvent } from '../types'

export type UseOpsStreamReturn = {
  events: OpsEvent[]
  connected: boolean
  error: string | null
  clear: () => void
}

const MAX_BUFFER = 500

/**
 * PRP-034 Sub-fase 3: hook que (a) hidrata con `/api/ops/recent?limit=200` y
 * (b) abre EventSource a `/api/ops/stream` para eventos vivos.
 *
 * Buffer cap 500 — evita memory leak en sesiones largas. Eventos viejos
 * descartados FIFO; el operador puede `clear()` manual.
 *
 * Cancellation: EventSource.close() en cleanup + AbortController para el
 * fetch inicial (PRP-030 canónico).
 */
export function useOpsStream(): UseOpsStreamReturn {
  const [events, setEvents] = useState<OpsEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const clear = useCallback(() => {
    setEvents([])
  }, [])

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    // Backfill inicial via /api/ops/recent (paralelo al EventSource).
    fetch('/api/ops/recent?limit=200', { signal: ac.signal })
      .then((r) => (r.ok ? (r.json() as Promise<{ events: OpsEvent[] }>) : { events: [] }))
      .then((body) => {
        if (ac.signal.aborted) return
        setEvents((prev) => {
          const existing = new Set(prev.map((e) => e.id))
          const fresh = body.events.filter((e) => !existing.has(e.id))
          return [...fresh, ...prev].slice(-MAX_BUFFER)
        })
      })
      .catch(() => undefined)

    // Live stream via EventSource (sin headers custom — auth via cookie en proxy).
    const es = new EventSource('/api/ops/stream')

    es.onopen = () => {
      setConnected(true)
      setError(null)
    }

    es.onerror = () => {
      setConnected(false)
      setError('Reconectando…')
    }

    es.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as OpsEvent
        setEvents((prev) => {
          if (prev.some((p) => p.id === event.id)) return prev
          return [...prev, event].slice(-MAX_BUFFER)
        })
      } catch {
        // Ignore non-JSON frames (keep-alive `: ping`, etc.).
      }
    }

    return () => {
      ac.abort()
      es.close()
    }
  }, [])

  return { events, connected, error, clear }
}
