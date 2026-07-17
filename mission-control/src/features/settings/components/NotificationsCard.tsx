'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Bell } from 'lucide-react'

/**
 * PRP-034 Sub-fase 6: card de Notifications real.
 *
 * (a) Detecta capability del browser via useSyncExternalStore (PRP-020/023/031).
 * (b) Toggle de subscription: subscribe → POST /api/notifications/subscribe;
 *     unsubscribe → DELETE /api/notifications/subscribe?endpoint=...
 * (c) Estado: 'supported' | 'permission-denied' | 'subscribed' | 'not-subscribed'.
 *
 * NEXT_PUBLIC_VAPID_PUBLIC_KEY se expone al cliente para subscribe.
 */
function getPushSupportSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window
}

function getPushSupportServerSnapshot(): boolean {
  return false
}

function subscribePushSupport(): () => void {
  return () => undefined
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function NotificationsCard() {
  const supported = useSyncExternalStore(
    subscribePushSupport,
    getPushSupportSnapshot,
    getPushSupportServerSnapshot,
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager?.getSubscription())
      .then((sub) => {
        if (!cancelled) setSubscribed(Boolean(sub))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [supported])

  async function handleToggle() {
    if (busy || !supported) return
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        setError('Service Worker no registrado. Reload la página.')
        return
      }
      if (subscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await fetch(
            `/api/notifications/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`,
            { method: 'DELETE' },
          )
          await sub.unsubscribe()
        }
        setSubscribed(false)
      } else {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidKey) {
          setError('VAPID_PUBLIC_KEY no configurada')
          return
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          // PushManager API espera BufferSource — el Uint8Array calza pero TS
          // strict tropieza con el ArrayBufferLike → ArrayBuffer. Cast explícito.
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
            .buffer as ArrayBuffer,
        })
        const res = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        })
        if (!res.ok) {
          await sub.unsubscribe()
          setError(`Error al guardar suscripción (${res.status})`)
          return
        }
        setSubscribed(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className="mc-card rounded-card p-5"
      aria-labelledby="settings-notifications-heading"
    >
      <header className="mb-4 flex items-center gap-2">
        <Bell
          size={16}
          strokeWidth={1.8}
          style={{ color: 'var(--label-secondary)' }}
        />
        <h2
          id="settings-notifications-heading"
          className="text-headline"
          style={{ color: 'var(--label-primary)' }}
        >
          Notificaciones
        </h2>
      </header>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-body"
            style={{ color: 'var(--label-primary)' }}
          >
            Activar push en este dispositivo
          </span>
          <span
            className="text-callout normal-case"
            style={{ color: 'var(--label-tertiary)' }}
          >
            {supported
              ? subscribed
                ? 'Activadas — el daemon puede avisarte aquí.'
                : 'Recibe avisos del daemon (cron fallidos, alertas, briefings).'
              : 'Este navegador no soporta push notifications.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={!supported || busy}
          className="mc-interactive rounded-full px-3 py-1.5 text-callout disabled:opacity-50"
          style={{
            background: subscribed ? 'var(--fill-secondary)' : 'var(--accent)',
            color: subscribed ? 'var(--label-primary)' : 'white',
          }}
        >
          {busy ? '…' : subscribed ? 'Desactivar' : 'Activar'}
        </button>
      </div>

      {error && (
        <p
          className="mt-3 text-caption2"
          style={{ color: 'var(--sys-red)' }}
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  )
}
