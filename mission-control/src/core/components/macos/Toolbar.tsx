'use client'

import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { ToolbarPill } from './ToolbarPill'
import { ToolbarIconButton } from './ToolbarIconButton'
import { ToolbarSearch } from './ToolbarSearch'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { titleForPath } from '@/features/shell/constants'

/**
 * Pill button accent que vive en el Toolbar y, por ruta, dispara la accion
 * primaria del modulo activo (create/new) via custom event escuchado por el
 * feature component correspondiente.
 *
 * Patron canonico Praxis para puentear shell global ↔ feature components
 * sin context: el feature component (ScheduledList / DrawList) registra
 * un `addEventListener` al event canonico (`aios:scheduled:new` /
 * `aios:draw:new`) en su `useEffect` de mount; el Toolbar dispatchea.
 * Cero acoplamiento Toolbar ↔ feature, cero context global, cero
 * round-trip URL (que generaria re-render del Server Component).
 *
 * Match por `===` exacto (NO prefix) — `/draw/<id>` NO debe mostrar el
 * boton "Nuevo canvas" porque ya esta dentro de un canvas especifico.
 */
function ToolbarRouteAction({ pathname }: { pathname: string }) {
  if (pathname === '/ai-agent') {
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('aios:ai-agent:new'))}
        aria-label="Nueva conversación"
        className="mc-interactive inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-callout font-semibold text-white"
        style={{ background: 'var(--accent)' }}
      >
        <Plus size={12} strokeWidth={2.2} />
        Nueva
      </button>
    )
  }
  if (pathname === '/scheduled') {
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('aios:scheduled:new'))}
        aria-label="Nuevo cron job"
        className="mc-interactive inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-callout font-semibold text-white"
        style={{ background: 'var(--accent)' }}
      >
        <Plus size={12} strokeWidth={2.2} />
        Nuevo
      </button>
    )
  }
  if (pathname === '/draw') {
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent('aios:draw:new'))}
        aria-label="Nuevo canvas"
        className="mc-interactive inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-callout font-semibold text-white"
        style={{ background: 'var(--accent)' }}
      >
        <Plus size={12} strokeWidth={2.2} />
        Nuevo
      </button>
    )
  }
  return null
}

/**
 * Toolbar top global del shell desktop.
 *
 * PRP-035: controles `←` `→` cableados a `window.history.back()` /
 * `window.history.forward()` directos. Siempre clickables (cero `disabled`
 * hardcoded) — patron canonico Finder/Safari/Chrome: si no hay history
 * disponible, el browser hace silent no-op.
 *
 * Por que `window.history` y no `useRouter` de next/navigation:
 *
 *   El `router.forward()` del App Router tiene un guard cliente-side que
 *   falla cero-op cuando el internal forward stack del Next router esta
 *   vacio. Eso ocurre tras un cold start, un full reload, o cualquier nav
 *   externa al SPA (typed URL, deep link, browser_navigate de Playwright).
 *   En esos casos `router.forward()` no hace nada aunque el browser tenga
 *   un forward entry valido en su history stack.
 *
 *   `window.history.back/forward` operan directo sobre el stack del browser
 *   sin pasar por el internal state del router. Patron canonico Finder/
 *   Safari/Chrome toolbar: el comportamiento que el operador espera.
 *
 *   Next App Router intercepta el `popstate` resultante igual y rehydrata
 *   la ruta correctamente — cero perdida de capabilities client-side.
 *
 * NO tracking de history index para disable inteligente: Next 16 no expone
 * el idx publicamente; hackearlo via `window.history.state.idx` interno
 * acopla codigo al SDK y rompe en upgrades.
 */
export function Toolbar() {
  const pathname = usePathname()
  const title = titleForPath(pathname)

  return (
    <header
      className="hairline-b relative flex items-center justify-between px-4"
      style={{ height: '44px' }}
    >
      <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-headline">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <ToolbarPill>
          <ToolbarIconButton
            icon={ChevronLeft}
            label="Back"
            onClick={() => window.history.back()}
          />
          <span
            aria-hidden
            className="mx-0.5 inline-block h-4 w-px"
            style={{ background: 'var(--separator)' }}
          />
          <ToolbarIconButton
            icon={ChevronRight}
            label="Forward"
            onClick={() => window.history.forward()}
          />
        </ToolbarPill>
      </div>

      <div className="flex items-center gap-2">
        <ToolbarRouteAction pathname={pathname} />
        <ToolbarSearch />
        <NotificationBell />
      </div>
    </header>
  )
}
