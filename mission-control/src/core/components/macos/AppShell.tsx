'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useIsMobile } from '@/core/hooks/useIsMobile'
import { useShellMode } from '@/core/hooks/useShellMode'
import { Window } from './Window'
import { Sidebar } from './Sidebar'
import { Toolbar } from './Toolbar'
import { MobileToolbar } from './MobileToolbar'
import { SidebarDrawer } from './SidebarDrawer'
import { WallpaperApplier } from './WallpaperApplier'

/**
 * AppShell — Client wrapper que decide chrome desktop vs mobile via useIsMobile.
 *
 * El padre (`(app)/layout.tsx`) es Server Component: ejecuta el auth gate
 * (createClient -> getUser -> isEmailAllowed -> redirect) y pasa {children} a
 * este AppShell. El AppShell elige UN ramal segun el viewport — desktop
 * (Window centrada + wallpaper en bordes byte-exact PRP-020/021/022) o mobile
 * (MobileToolbar + main full-bleed + SidebarDrawer off-canvas).
 *
 * Usar `useIsMobile` (no `hidden md:block` / `md:hidden`) evita renderizar
 * {children} dos veces en el arbol React — importante cuando las paginas
 * hijas hacen fetch / tienen useEffect. SSR siempre renderiza desktop; el
 * cliente rehidrata con matchMedia real.
 *
 * PRP-034: TweaksPopover removido; Theme/Accent/Wallpaper viven en
 * /settings AppearanceCard. El shell ya no monta popovers globales en bottom-left.
 *
 * PRP-036 iter post-cierre: consumer canónico del hook `useShellMode`. El
 * shell tiene 3 modos discretos: 'floating' (default, con wallpaper en
 * bordes), 'expanded' (CSS edge-to-edge dentro del browser), 'fullscreen'
 * (CSS edge-to-edge + Fullscreen API browser). Visualmente 'expanded' y
 * 'fullscreen' son idénticos en CSS — la diferencia (Fullscreen API) la
 * decide el hook. Por eso la className `is-expanded` aplica cuando
 * `mode !== 'floating'`. La transición CSS de padding 320ms vive en
 * `globals.css` (regla `.mc-shell-viewport` FUERA de `@layer utilities`).
 *
 * También sincroniza el atributo `data-shell-mode` sobre `<html>` vía
 * `useEffect` reactivo al state del hook — esto cubre rehidrataciones
 * (primer paint del cliente tras reload) + sincronización cross-tab (storage
 * event del subscribe del hook). El setter del hook ya muta el atributo en
 * cada cambio interactivo; el useEffect es defense-in-depth para los caminos
 * no interactivos. Idempotente.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mode] = useShellMode()

  useEffect(() => {
    document.documentElement.dataset.shellMode = mode
  }, [mode])

  if (isMobile) {
    return (
      <>
        <WallpaperApplier />
        <div className="flex h-dvh flex-col">
          <MobileToolbar onOpenMenu={() => setDrawerOpen(true)} />
          <main className="relative flex-1 overflow-auto">{children}</main>
        </div>
        <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </>
    )
  }

  return (
    <>
      <WallpaperApplier />
      <div
        className={[
          'mc-shell-viewport relative h-dvh w-screen',
          mode !== 'floating' ? 'is-expanded' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          padding:
            'max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))',
        }}
      >
        <Window>
          <Sidebar />
          <div className="relative flex h-full min-w-0 flex-col bg-white dark:bg-[#1c1c1e]">
            <Toolbar />
            <main className="relative flex-1 overflow-auto">{children}</main>
          </div>
        </Window>
      </div>
    </>
  )
}
