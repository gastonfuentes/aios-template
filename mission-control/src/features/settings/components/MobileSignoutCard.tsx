'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useIsMobile } from '@/core/hooks/useIsMobile'
import { SignoutConfirmDialog } from '@/core/components/macos/SignoutConfirmDialog'

/**
 * Iter 2026-05-15: card "Cerrar sesión" al final de `/settings` solo en
 * mobile. En desktop, el sign-out vive como botón rojo del cluster de
 * traffic lights del Sidebar — accesible desde cualquier ruta sin tener que
 * navegar a Settings.
 *
 * En mobile, los traffic lights del MobileToolbar fueron removidos a pedido
 * del operador (no hay shell flotante/expandido/fullscreen aplicable). El
 * sign-out queda como botón dedicado al final de la página de Settings,
 * coherente con el patrón iOS native ("Sign Out" como acción destructiva al
 * fondo del Settings tab).
 *
 * Renderea `null` en desktop — el card solo aparece cuando `useIsMobile()`
 * retorna `true`. El hook ya cubre flicker mismatch SSR/client: primer paint
 * cliente asume desktop (no renderea el card), rehidrata con matchMedia real
 * en el next paint. Si el operador está en mobile, el card aparece tras el
 * second paint sin causar layout shift de los cards previos (es el último).
 */
export function MobileSignoutCard() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (!isMobile) return null

  return (
    <>
      <section
        className="mc-card rounded-card p-5"
        aria-labelledby="settings-signout-heading"
      >
        <h2
          id="settings-signout-heading"
          className="sr-only"
        >
          Sesión
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mc-interactive flex w-full items-center justify-center gap-2 rounded-control py-3 text-body font-medium text-white"
          style={{
            background: 'var(--sys-red)',
            boxShadow: 'var(--shadow-control)',
          }}
          aria-label="Cerrar sesión"
        >
          <LogOut size={14} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </section>

      <SignoutConfirmDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
