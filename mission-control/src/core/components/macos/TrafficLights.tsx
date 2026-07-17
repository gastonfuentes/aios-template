'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/core/ui/dropdown-menu'
import type { ShellMode } from '@/core/hooks/useShellMode'

/**
 * PRP-036 iter post-cierre: cluster macOS-flavored de 3 traffic lights.
 *
 * Convención macOS native canónica (operador re-aligned 2026-05-15): los
 * traffic lights viven en la esquina superior IZQUIERDA del shell. En el
 * MC desktop esto es el Sidebar (que ocupa el slot izquierdo del grid
 * Window). El operador revirtió la decisión "derecha" del PRP-036 original
 * tras ver el resultado y preferir la convención macOS native.
 *
 * Colores hex literales fuera de tokens DS macOS 26:
 *   - Rojo  `#FF5F57`  — cerrar sesión (abre `SignoutConfirmDialog`)
 *   - Amarillo `#FEBC2E` — placeholder explícito sin handler
 *   - Verde `#28C840`  — toggle shell mode (abre DropdownMenu con 3 opciones)
 *
 * Sin iconos internos (PRP-036 iter post-cierre). Los círculos son color
 * sólido puro — convención macOS native byte-exact donde los icons sólo
 * aparecen al pasar el cursor sobre el cluster en algunas versiones. El
 * operador prefirió cero icons por minimalismo.
 *
 * El verde abre un `<DropdownMenu>` con 3 opciones radio:
 *   1. Flotante         — Window centrada con wallpaper en bordes (default)
 *   2. Ventana expandida — CSS edge-to-edge dentro del browser, browser
 *                          chrome (tabs/address bar) sigue visible
 *   3. Pantalla completa — CSS edge-to-edge + Fullscreen API real que
 *                          oculta el browser chrome
 *
 * Diámetro 12px (h-3 w-3). Gap horizontal 8px (gap-2). Cero icono interior.
 *
 * Props:
 *   - `mode` + `onChangeMode`: para el verde (DropdownMenu RadioGroup).
 *   - `onClose`: para el rojo (típico: abrir el SignoutConfirmDialog).
 *   - `compact?`: cuando `true`, renderea SOLO el rojo (caso MobileToolbar).
 */
type TrafficLightsProps = {
  mode: ShellMode
  onChangeMode: (mode: ShellMode) => void
  onClose: () => void
  compact?: boolean
}

const RED = '#FF5F57'
const YELLOW = '#FEBC2E'
const GREEN = '#28C840'

const RING = 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.18)'

const greenAriaLabel: Record<ShellMode, string> = {
  floating: 'Cambiar tamaño de la ventana',
  expanded: 'Cambiar tamaño de la ventana (expandida)',
  fullscreen: 'Cambiar tamaño de la ventana (pantalla completa)',
}

export function TrafficLights({
  mode,
  onChangeMode,
  onClose,
  compact = false,
}: TrafficLightsProps) {
  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Controles de ventana"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
        className="mc-interactive h-3 w-3 rounded-full"
        style={{ background: RED, boxShadow: RING }}
      />

      {!compact && (
        <>
          <span
            role="button"
            aria-label="No disponible"
            aria-disabled="true"
            tabIndex={-1}
            title="No disponible"
            className="mc-interactive h-3 w-3 rounded-full"
            style={{ background: YELLOW, boxShadow: RING }}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={greenAriaLabel[mode]}
                title={greenAriaLabel[mode]}
                className="mc-interactive h-3 w-3 rounded-full"
                style={{ background: GREEN, boxShadow: RING }}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="aios-shell-menu"
            >
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(v) => onChangeMode(v as ShellMode)}
              >
                <DropdownMenuRadioItem value="floating">
                  Flotante
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="expanded">
                  Ventana expandida
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="fullscreen">
                  Pantalla completa
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}
