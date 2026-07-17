'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/core/adapters/supabase/browser'
import type { AIOSNotification } from '../types'

export type UseNotificationsReturn = {
  notifications: AIOSNotification[]
  unreadCount: number
  refresh: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

/**
 * PRP-034 Sub-fase 6: hook que (a) fetcha últimas 50 via /api/notifications,
 * (b) suscribe a `aios_notifications` realtime channel para incrementar el
 * badge cuando llega un row nuevo, (c) expone mark-as-read individual/bulk.
 *
 * Cancellation via AbortController + cleanup del realtime channel.
 */
export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<AIOSNotification[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch('/api/notifications?limit=50', { signal: ac.signal })
      if (!res.ok) return
      const body = (await res.json()) as { notifications: AIOSNotification[] }
      if (!ac.signal.aborted) setNotifications(body.notifications)
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    // Initial fetch on mount (canónico PRP-030 — eslint-disable-next-line)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()

    // Realtime channel: cuando llega INSERT a aios_notifications, refrescamos.
    const supabase = createClient()
    const channel = supabase
      .channel('aios_notifications_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'aios_notifications' },
        () => {
          void refresh()
        },
      )
      .subscribe()

    return () => {
      abortRef.current?.abort()
      supabase.removeChannel(channel)
    }
  }, [refresh])

  const markRead = useCallback(
    async (id: string) => {
      await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
      })
      await refresh()
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    await fetch('/api/notifications/mark-all-read', { method: 'POST' })
    await refresh()
  }, [refresh])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  return { notifications, unreadCount, refresh, markRead, markAllRead }
}
