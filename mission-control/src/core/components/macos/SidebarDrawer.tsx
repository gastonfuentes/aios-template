'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { Sidebar } from './Sidebar'

/**
 * SidebarDrawer — off-canvas mobile.
 *
 * Renderiza el Sidebar canonico byte-exact dentro de un portal a document.body
 * para escapar ancestros con backdrop-filter / overflow:hidden / transform que
 * crearian un containing block para position:fixed (mismo workaround del Modal
 * primitive, PRP-021).
 *
 * Animaciones heredan los tokens canonicos del DS macOS 26:
 * - backdrop: mc-backdrop-in (180ms linear)
 * - panel:    mc-drawer-in-left (220ms ease-decelerate)
 *
 * Auto-cierre al navegar (cambio de pathname) — Link clicks dentro del Sidebar
 * disparan navigation, este effect detecta el pathname nuevo y llama onClose.
 * El estado real lo gestiona el padre (AppShell).
 *
 * NO implementa focus trap (PRP-023 fuera de alcance). Coherente con el primitive
 * Modal del MC que tampoco lo tiene.
 */
export function SidebarDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const pathname = usePathname()
  const lastPathnameRef = useRef(pathname)

  // Auto-cierre al navegar dentro del drawer (tap en SidebarItem -> Link click
  // -> pathname change). Comparamos contra lastPathnameRef para evitar disparar
  // cuando el drawer recien abre con el mismo pathname.
  useEffect(() => {
    if (!open) {
      lastPathnameRef.current = pathname
      return
    }
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname
      onClose()
    }
  }, [pathname, open, onClose])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node | null
      if (!target) return
      if (panelRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDocClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="mc-backdrop-in fixed inset-0 z-[90]"
      style={{
        background: 'rgba(0, 0, 0, 0.40)',
        backdropFilter: 'blur(16px) saturate(140%)',
        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Mission Control navigation"
    >
      <div
        ref={panelRef}
        className="mc-drawer-in-left fixed left-0 top-0 flex h-dvh flex-col"
        style={{
          width: 'min(320px, 88vw)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          boxShadow: 'var(--shadow-window)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="mc-interactive absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--label-secondary)] hover:bg-[color:var(--fill-secondary)] hover:text-[color:var(--label-primary)]"
        >
          <X size={14} strokeWidth={1.8} />
        </button>
        <Sidebar />
      </div>
    </div>,
    document.body
  )
}
