'use client'

/**
 * Hook Client del sidebar de historial cross-superficie (PRP-030).
 *
 * Pipeline de datos:
 *   1. `GET /api/chat/sessions?limit=50` (proxy MC → daemon) →
 *      `{ sessions: SDKSessionInfo[] }` con `linkedChatSessionId` enriquecido.
 *   2. JOIN semántico contra Supabase `chat_sessions` (browser client + RLS
 *      owner-only) para sobreescribir títulos cuando hay match por
 *      `linkedChatSessionId === chat_sessions.id`. Si Supabase falla, fail-soft
 *      (los títulos quedan como `customTitle/summary` del SDK).
 *   3. Ordenar por `lastModified` desc + slice al límite.
 *   4. Re-fetch on:
 *      - Mount (initial load).
 *      - `visibilitychange === 'visible'` (vuelve del background).
 *      - `refetch()` invocado por el caller (tras send / delete).
 *
 * Estado React:
 *   - `sessions: ChatHistoryItem[]`
 *   - `isLoading: boolean`
 *   - `error: string | null` (string genérico, fail-soft → array vacío + error)
 *
 * Reglas: cero `setState` en effects derivados de input. El único effect
 * legítimo es el listener `visibilitychange` (cleanup function obligatoria) y
 * la primera carga via `useEffect(() => { void load() }, [])` con `cancelled`
 * flag — patrón canónico (PRP-003/005/012/020).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/core/adapters/supabase/browser'
import {
  SessionsResponseSchema,
  type ChatHistoryItem,
  type SDKSessionInfo,
} from '../contracts/messages'

const SESSIONS_ENDPOINT = '/api/chat/sessions?limit=50'
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type UseChatHistoryReturn = {
  sessions: ChatHistoryItem[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useChatHistory(): UseChatHistoryReturn {
  const [sessions, setSessions] = useState<ChatHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Ref para abortar fetches in-flight cuando el componente desmonta o se
  // re-dispara un fetch nuevo antes de que el anterior termine.
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (): Promise<void> => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setIsLoading(true)
    setError(null)

    try {
      // ─── 1. Daemon sessions ──────────────────────────────────────────────
      const res = await fetch(SESSIONS_ENDPOINT, {
        method: 'GET',
        signal: ac.signal,
        // No-cache: el cache 60s ya vive en el daemon; el browser puede
        // duplicarlo y desfasar.
        cache: 'no-store',
      })

      if (!res.ok) {
        if (ac.signal.aborted) return
        setError(`historial: HTTP ${res.status}`)
        setSessions([])
        setIsLoading(false)
        return
      }

      const json: unknown = await res.json().catch(() => ({ sessions: [] }))
      const parsed = SessionsResponseSchema.safeParse(json)
      if (!parsed.success) {
        if (ac.signal.aborted) return
        setError('historial: shape inválido del daemon')
        setSessions([])
        setIsLoading(false)
        return
      }
      const sdkSessions: SDKSessionInfo[] = parsed.data.sessions

      // ─── 2. JOIN con Supabase chat_sessions (best-effort, fail-soft) ────
      //
      // BUG-FIX PRP-030 polish: el filtro `.in('id', linkedIds)` requiere que
      // CADA elemento sea un UUID válido — Postgres rechaza la query entera
      // con HTTP 400 si encuentra un literal no-UUID (ej. `'telegram'` o un
      // chat_id numérico de Telegram como `'6460983932'`). Eso rompía el JOIN
      // por completo y todos los títulos caían al `customTitle/summary` del
      // SDK. Filtrar a UUID v4 estrictamente antes del query.
      const titleByChatSessionId = new Map<string, string>()
      const linkedIds = sdkSessions
        .map((s) => s.linkedChatSessionId)
        .filter((id): id is string => typeof id === 'string' && UUID_V4_REGEX.test(id))

      if (linkedIds.length > 0) {
        try {
          const supabase = createClient()
          const { data: rows, error: dbErr } = await supabase
            .from('chat_sessions')
            .select('id, title')
            .in('id', linkedIds)
          if (!dbErr && rows) {
            for (const row of rows as { id: string; title: string }[]) {
              if (row.title && row.title !== 'New Chat') {
                titleByChatSessionId.set(row.id, row.title)
              }
            }
          }
        } catch {
          // Fail-soft: el listado renderea con summary del SDK como fallback.
        }
      }

      if (ac.signal.aborted) return

      // ─── 3. Mapeo a ChatHistoryItem + sort ──────────────────────────────
      const items: ChatHistoryItem[] = sdkSessions.map((s) => {
        const linkedId = s.linkedChatSessionId ?? null
        const supabaseTitle = linkedId ? titleByChatSessionId.get(linkedId) : undefined
        const title =
          supabaseTitle?.trim() ||
          s.customTitle?.trim() ||
          s.summary?.trim() ||
          s.firstPrompt?.trim().slice(0, 60) ||
          'Sin título'
        return {
          sdkSessionId: s.sessionId,
          chatSessionId: linkedId,
          title,
          lastModifiedMs: s.lastModified,
          cwd: s.cwd,
          gitBranch: s.gitBranch,
        }
      })

      items.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs)

      setSessions(items)
      setIsLoading(false)
    } catch (err) {
      if (ac.signal.aborted) return
      if (err instanceof DOMException && err.name === 'AbortError') return
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setSessions([])
      setIsLoading(false)
    }
  }, [])

  // Initial load on mount.
  //
  // Aprendizaje canónico Praxis PRP-003/005/012/020: "set-state-in-effect" se
  // resuelve con (a) useMemo si el state es derivado de input, (b) `cancelled`
  // flag si es async probing externo, (c) handler trigger si es trigger boolean,
  // o (d) `useSyncExternalStore` si es state ligado a plataforma con N consumers.
  //
  // Este caso es (b) puro: fetch HTTP async on mount. NO hay sustituto Suspense-
  // free en React 19 — `use(promise)` Suspende el render y rompe el shimmer
  // local (queremos mostrar loading skeleton inline, no Suspense boundary).
  // La regla está pensada para anti-patrones tipo `useState + useEffect(() => setX(probe()))`
  // SIN cancellation; `load()` SÍ tiene `abortRef.current?.abort()` antes de cada
  // fetch + check de `ac.signal.aborted` antes de cada setState. Excepción
  // documentada — la regla queda activa para todo el resto del codebase.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    return () => {
      abortRef.current?.abort()
    }
  }, [load])

  // Refetch on visibilitychange === 'visible' (recupera focus tras background).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const handler = () => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      document.removeEventListener('visibilitychange', handler)
    }
  }, [load])

  const refetch = useCallback(() => {
    void load()
  }, [load])

  return { sessions, isLoading, error, refetch }
}
