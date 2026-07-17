'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal canonico del MC.
 *
 * Renderiza via createPortal al document.body para escapar ancestros con
 * backdrop-filter / overflow:hidden / transform que crearian un containing
 * block para position:fixed (lo que atraparia el modal al bounding box del
 * ancestor en vez del viewport — caso real: SignoutButton dentro del Sidebar
 * con liquid-glass-regular activo).
 *
 * El backdrop dimea con bg-black/40 + backdrop-filter blur(16px) saturate(140%)
 * para el feel macOS sheet (lo de atras queda en blur, en lugar de solo bajado).
 *
 * Entrada animada: mc-backdrop-in (180ms) + mc-overlay-in (220ms) — heredan
 * el contrato definido en globals.css.
 *
 * Manejadores integrados: click-fuera-del-panel cierra; Escape cierra. El
 * consumidor solo controla open/onClose desde su state.
 *
 * Para popovers ANCLADOS A UN TRIGGER (no full-screen), NO usar este Modal —
 * usar non-modal floating anchor pattern (caso histórico: TweaksPopover hasta
 * PRP-034 que lo desmontó en favor de cards Settings).
 */
export type ModalPlacement = 'center' | 'sheet-left' | 'sheet-right'

export function Modal({
  open,
  onClose,
  label,
  role = 'dialog',
  children,
  panelClassName = '',
  panelMaxWidth = '420px',
  placement = 'center',
}: {
  open: boolean
  onClose: () => void
  label: string
  role?: 'dialog' | 'alertdialog'
  children: ReactNode
  panelClassName?: string
  panelMaxWidth?: string
  /**
   * Posicionamiento del panel:
   *   - `center` (default): centrado vertical+horizontal, animación scale+fade
   *     (`mc-overlay-in`). Panel rounded-window-sm.
   *   - `sheet-left` (PRP-030): pegado a la izquierda full-height, slide-in
   *     desde la izquierda (`mc-drawer-in-left`). Panel con esquinas derechas
   *     redondeadas + esquinas izquierdas a ras (sheet macOS-flavored).
   *   - `sheet-right` (PRP-034): pegado a la derecha full-height, slide-in
   *     desde la derecha (`mc-drawer-in-right`). Consumido por SearchRightbar.
   */
  placement?: ModalPlacement
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)

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

  const isSheetLeft = placement === 'sheet-left'
  const isSheetRight = placement === 'sheet-right'

  // h-full (no h-dvh): el panel hereda 100% del container effective height.
  // Container es flex con items-stretch sobre fixed inset-0, así que el
  // container ocupa 100dvh sin shrink y h-full == 100dvh en todos los shell
  // modes (floating, expanded, fullscreen) — el sheet right es edge-anchored
  // top-to-bottom en los 3 modes desde PRP-037.
  let panelClasses: string
  if (isSheetLeft) {
    panelClasses = `liquid-glass-thick mc-drawer-in-left h-full rounded-r-2xl ${panelClassName}`
  } else if (isSheetRight) {
    panelClasses = `liquid-glass-thick mc-drawer-in-right h-full rounded-l-2xl ${panelClassName}`
  } else {
    panelClasses = `liquid-glass-thick mc-overlay-in rounded-window-sm ${panelClassName}`
  }

  // PRP-037: cuando placement='sheet-right', el panel suma la clase
  // `.mc-sheet-right-panel` para que la regla CSS (en globals.css, fuera de
  // @layer utilities) le aplique `border-radius: var(--r-window) 0 0 var(--r-window)`
  // — solo las 2 esquinas izquierdas redondeadas tipo squircle macOS 26 (26px),
  // las 2 derechas flush con el borde derecho del viewport. Aplica a TODOS los
  // shell modes (floating / expanded / fullscreen) — el sheet right es
  // edge-anchored al borde derecho del viewport en los 3 modes (feels drawer
  // macOS canónico Finder/Notes/Mail). El `rounded-l-2xl` de Tailwind (16px)
  // queda como fallback si la regla CSS por alguna razón no carga; la regla
  // canónica gana por especificidad (clase scoped > utility Tailwind sin
  // !important).
  //
  // mc-sheet-right-container: clase reservada para futuras reglas scoped del
  // container externo. Hoy NO declara nada (el iter 2026-05-15 que aplicaba
  // padding 24 en floating fue revertido por PRP-037 — sheet edge-anchored,
  // cero padding).
  const containerExtraClass = isSheetRight ? ' mc-sheet-right-container' : ''
  const panelExtraClass = isSheetRight ? ' mc-sheet-right-panel' : ''

  const isSheet = isSheetLeft || isSheetRight

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex ${
        isSheetLeft
          ? 'items-stretch justify-start'
          : isSheetRight
            ? 'items-stretch justify-end'
            : 'mc-backdrop-in items-center justify-center p-6'
      }${containerExtraClass}`}
      style={
        isSheet
          ? // PRP-037 iter post-cierre 2: sheets (right + left) NO llevan backdrop
            // dim + backdrop-filter blur del Modal pattern. Razón canónica macOS:
            // sheets right-side / left-side de Finder/Notes/Mail son columnas
            // anchored al borde del shell, no Modales flotantes con overlay
            // dim. Sin backdrop dim/blur, las 2 esquinas curvadas del squircle
            // del panel (top-left + bottom-left para sheet-right; top-right +
            // bottom-right para sheet-left) muestran el shell del MC directo
            // (chrome opaco), no un "translúcido fantasmal" del backdrop dim
            // con blur del wallpaper. El feels macOS canónico se conserva con
            // la sombra direccional del panel (`-12px 0 32px` / `12px 0 32px`)
            // que indica elevación sin dim. El `pointer-events-none` permite
            // click-fuera porque el handler `onDocClick` del Modal sigue activo
            // (panelRef.contains() detecta el target fuera del panel).
            // Center placement preserva backdrop dim byte-exact (caso original
            // Signout confirm, etc.).
            { pointerEvents: 'auto' }
          : {
              background: 'rgba(0, 0, 0, 0.40)',
              backdropFilter: 'blur(16px) saturate(140%)',
              WebkitBackdropFilter: 'blur(16px) saturate(140%)',
            }
      }
      role={role}
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={panelRef}
        className={`${panelClasses}${panelExtraClass}`}
        style={{
          // PRP-037 iter post-cierre: el sheet-right edge-anchored NO debe llevar
          // el `--shadow-window` standard porque su segundo stop es un ring
          // hairline `0 0 0 1px rgba(0,0,0,0.55)` diseñado para Window flotante
          // — ese ring sigue el border-radius del panel (squircle 26px en las 2
          // esquinas izquierdas) y produce un halo "fantasmal" translúcido detrás
          // de las esquinas redondeadas que el operador percibió como "esquinas
          // marcadas translúcidas detrás de la esquina redonda" (issue real
          // descubierto post-PRP-037 commit `5eb7d7c`). Override con shadow
          // direccional SOLO hacia la izquierda (el único lado del sheet que
          // limita con contenido visible — las esquinas derecha/top/bottom están
          // flush al borde del viewport, sus sombras quedarían fuera de pantalla).
          // Sheet-left mantiene el mismo patrón espejo (sombra solo hacia derecha).
          // Center placement preserva `--shadow-window` byte-exact (caso original).
          // PRP-037 iter final post-feedback operador 2026-05-16: revertido
          // iter #4 (hairline inset) → restaurada sombra direccional iter #1
          // por pedido explícito del operador "regresa las sombras". Sombra
          // direccional solo hacia el lado opuesto al edge-anchor (sheet-right
          // → sombra hacia la izquierda; sheet-left → sombra hacia la derecha);
          // los otros 3 lados están flush al borde del viewport, sus sombras
          // quedarían fuera de pantalla. Cero ring 1px (preservado iter #1
          // vs `--shadow-window` que apila hairline ring). Center placement
          // preserva `var(--shadow-window)` byte-exact (caso Window-like).
          boxShadow:
            isSheetRight
              ? '-12px 0 32px rgba(0, 0, 0, 0.35)'
              : isSheetLeft
                ? '12px 0 32px rgba(0, 0, 0, 0.35)'
                : 'var(--shadow-window)',
          maxWidth: panelMaxWidth,
          width: '100%',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
