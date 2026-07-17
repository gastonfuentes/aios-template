'use client'

import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { titleForPath } from '@/features/shell/constants'

/**
 * MobileToolbar — toolbar slim para viewports < 768px.
 *
 * Hamburger en slot izquierdo (abre SidebarDrawer via onOpenMenu), titulo
 * dinamico centrado (mismo titleForPath que el Toolbar desktop), slot derecho
 * spacer. Sin back/forward (gesto iOS swipe-from-edge cubre el caso en PWA
 * standalone) y sin search (diferido a un PRP futuro).
 *
 * El header respeta env(safe-area-inset-top) para no quedar debajo del status
 * bar / dynamic island en iPhone PWA standalone.
 *
 * Iter 2026-05-15: traffic lights REMOVIDOS del MobileToolbar a pedido del
 * operador. En mobile no hay shell flotante/expandido/fullscreen aplicable
 * (el viewport mobile ya es full-bleed app-native), y el sign-out vive ahora
 * como botón dedicado al final de `/settings` vía `<MobileSignoutCard>`.
 */
export function MobileToolbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()
  const title = titleForPath(pathname)

  return (
    <header
      className="hairline-b sticky top-0 z-20 flex items-center justify-between px-3"
      style={{
        height: 'calc(36px + env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
        background: 'var(--material-thick-light)',
        backdropFilter: 'saturate(200%) blur(56px)',
        WebkitBackdropFilter: 'saturate(200%) blur(56px)',
      }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        className="mc-interactive inline-flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--label-primary)] hover:bg-[color:var(--fill-secondary)]"
      >
        <Menu size={16} strokeWidth={1.8} />
      </button>

      <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-headline">
        {title}
      </h1>

      <div aria-hidden className="h-8 w-8" />
    </header>
  )
}
