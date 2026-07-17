'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNotifications } from '../hooks/useNotifications'
import type { AIOSNotification, NotificationSeverity } from '../types'

function severityColor(severity: NotificationSeverity): string {
  switch (severity) {
    case 'error':
      return 'var(--sys-red)'
    case 'warn':
      return 'var(--sys-orange)'
    case 'success':
      return 'var(--sys-green)'
    case 'info':
    default:
      return 'var(--sys-blue)'
  }
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const recentTen = notifications.slice(0, 10)

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
        className="mc-interactive relative inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--label-secondary)] hover:bg-[color:var(--fill-secondary)]"
      >
        <Bell size={13} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-none text-white"
            style={{ background: 'var(--sys-red)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Notifications"
          className="liquid-glass-thick mc-overlay-in absolute right-0 top-full z-50 mt-2 w-80 rounded-[14px] p-2"
          style={{ boxShadow: 'var(--shadow-popover)' }}
        >
          <header className="mb-1 flex items-center justify-between px-2 py-1">
            <span className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
              Notificaciones {unreadCount > 0 && `(${unreadCount} sin leer)`}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="mc-interactive text-caption2 hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Marcar todo
              </button>
            )}
          </header>

          {recentTen.length === 0 && (
            <p
              className="px-2 py-6 text-center text-callout normal-case"
              style={{ color: 'var(--label-tertiary)' }}
            >
              Sin notificaciones aún.
            </p>
          )}

          <div className="flex max-h-96 flex-col gap-0.5 overflow-auto">
            {recentTen.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onClick={() => {
                  if (!n.read_at) void markRead(n.id)
                  setOpen(false)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationRow({
  notification: n,
  onClick,
}: {
  notification: AIOSNotification
  onClick: () => void
}) {
  const content = (
    <div className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-[color:var(--fill-secondary)]">
      <span
        aria-hidden
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: n.read_at ? 'transparent' : severityColor(n.severity) }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className="truncate text-callout"
          style={{
            color: n.read_at ? 'var(--label-tertiary)' : 'var(--label-primary)',
            fontWeight: n.read_at ? 400 : 500,
          }}
        >
          {n.title}
        </span>
        {n.body && (
          <span
            className="line-clamp-2 text-callout normal-case"
            style={{ color: 'var(--label-tertiary)' }}
          >
            {n.body}
          </span>
        )}
        <span className="text-caption2" style={{ color: 'var(--label-tertiary)' }}>
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
        </span>
      </div>
    </div>
  )

  if (n.link) {
    return (
      <Link href={n.link} onClick={onClick} className="mc-interactive">
        {content}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className="mc-interactive text-left">
      {content}
    </button>
  )
}
