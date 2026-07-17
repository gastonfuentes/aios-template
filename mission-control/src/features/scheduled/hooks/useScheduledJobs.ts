'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScheduledTask } from '../types'

export type UseScheduledJobsReturn = {
  tasks: ScheduledTask[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  runNow: (id: string) => Promise<void>
  pause: (id: string) => Promise<void>
  resume: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  create: (input: { id: string; prompt: string; schedule: string }) => Promise<{ ok: boolean; error?: string }>
  update: (id: string, fields: { prompt?: string; schedule?: string }) => Promise<{ ok: boolean; error?: string }>
}

/**
 * PRP-034 Sub-fase 2: hook que consume `/api/scheduled/*` proxy MC → daemon.
 *
 * - `refresh()` re-fetcha tras cualquier mutación (run/pause/resume/create/update/delete).
 * - Cancellation via AbortController (PRP-030 canónico): cada nuevo fetch cancela el previo.
 * - `error` consume el JSON body del daemon byte-exact (`{ error, detail? }`).
 */
export function useScheduledJobs(): UseScheduledJobsReturn {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    try {
      const res = await fetch('/api/scheduled', { signal: ac.signal })
      if (!res.ok) {
        setError(`Daemon retornó ${res.status}`)
        setTasks([])
        return
      }
      const body = (await res.json()) as { tasks: ScheduledTask[] }
      if (ac.signal.aborted) return
      setTasks(body.tasks ?? [])
      setError(null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Aprendizaje canónico PRP-030: fetch HTTP on mount sin sustituto Suspense-free.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
    return () => abortRef.current?.abort()
  }, [refresh])

  async function mutate(path: string, method: 'POST' | 'DELETE'): Promise<void> {
    await fetch(path, { method })
    await refresh()
  }

  return {
    tasks,
    loading,
    error,
    refresh,
    runNow: (id) => mutate(`/api/scheduled/${encodeURIComponent(id)}/run`, 'POST'),
    pause: (id) => mutate(`/api/scheduled/${encodeURIComponent(id)}/pause`, 'POST'),
    resume: (id) => mutate(`/api/scheduled/${encodeURIComponent(id)}/resume`, 'POST'),
    remove: (id) => mutate(`/api/scheduled/${encodeURIComponent(id)}`, 'DELETE'),
    create: async (input) => {
      const res = await fetch('/api/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (res.ok) {
        await refresh()
        return { ok: true }
      }
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string
        detail?: string
      }
      return {
        ok: false,
        error: errBody.detail ?? errBody.error ?? `HTTP ${res.status}`,
      }
    },
    update: async (id, fields) => {
      const res = await fetch(`/api/scheduled/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (res.ok) {
        await refresh()
        return { ok: true }
      }
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string
        detail?: string
      }
      return {
        ok: false,
        error: errBody.detail ?? errBody.error ?? `HTTP ${res.status}`,
      }
    },
  }
}
