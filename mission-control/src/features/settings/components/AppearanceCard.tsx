'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Palette, ChevronRight } from 'lucide-react'
import { ACCENT_SWATCHES } from '@/features/shell/constants'
import { useAccent } from '@/core/hooks/useAccent'
import { useIsMobile } from '@/core/hooks/useIsMobile'
import { useShellMode, type ShellMode } from '@/core/hooks/useShellMode'
import { useWallpaper } from '@/core/hooks/useWallpaper'
import { WallpaperLibrary } from '@/core/components/macos/WallpaperLibrary'

// `mounted` flag canónico Praxis: useSyncExternalStore retorna false en SSR
// y true en cliente (next paint). Evita hydration mismatch del theme
// segmented indicator pill que depende de localStorage. PRP-020/023/031
// pattern reciclado.
function getMountedSnapshot(): boolean {
  return true
}
function getMountedServerSnapshot(): boolean {
  return false
}
function subscribeMounted(): () => void {
  return () => undefined
}
function useMounted(): boolean {
  return useSyncExternalStore(
    subscribeMounted,
    getMountedSnapshot,
    getMountedServerSnapshot,
  )
}

/**
 * PRP-034 Sub-fase 1: card "Apariencia" en /settings.
 * Migra Theme/Accent/Wallpaper desde el extinto TweaksPopover. Patrón canónico
 * de segmented control con indicator deslizante (PRP-021) preservado.
 *
 * Reusa `WallpaperLibrary` byte-exact (PRP-020) — solo cambia el trigger.
 */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()
  const [accent, setAccent] = useAccent()
  const [shellMode, setShellMode] = useShellMode()
  const isMobile = useIsMobile()
  const { active: activeWallpaper } = useWallpaper()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const previousObjectUrl = useRef<string | null>(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  const activeWallpaperPreviewUrl = useMemo<string>(
    () =>
      activeWallpaper.kind === 'preset'
        ? activeWallpaper.url
        : URL.createObjectURL(activeWallpaper.record.blob),
    [activeWallpaper]
  )

  useEffect(() => {
    const prev = previousObjectUrl.current
    previousObjectUrl.current =
      activeWallpaper.kind === 'custom' ? activeWallpaperPreviewUrl : null
    if (prev && prev !== activeWallpaperPreviewUrl) {
      URL.revokeObjectURL(prev)
    }
    return () => {
      if (previousObjectUrl.current) {
        URL.revokeObjectURL(previousObjectUrl.current)
        previousObjectUrl.current = null
      }
    }
  }, [activeWallpaper, activeWallpaperPreviewUrl])

  // En SSR + primer render del cliente usamos default 'dark' (consistente con
  // ThemeProvider defaultTheme). Cuando `mounted` se vuelve true, leemos el
  // theme real del localStorage. Esto evita el hydration mismatch.
  const resolvedTheme = mounted ? (theme ?? 'dark') : 'dark'

  // Mismo `mounted` pattern PRP-034 para el segmented 3-way "Ventana del MC" —
  // SSR + primer render asume 'floating' consistente con `getServerSnapshot`
  // del hook `useShellMode`. Cliente rehidrata con valor real de localStorage
  // en el next paint sin hydration mismatch. PRP-036 iter post-cierre.
  const resolvedShellMode: ShellMode = mounted ? shellMode : 'floating'
  const shellModeIndex =
    resolvedShellMode === 'floating' ? 0 : resolvedShellMode === 'expanded' ? 1 : 2

  return (
    <>
      <section
        className="mc-card rounded-card p-5"
        aria-labelledby="settings-appearance-heading"
      >
        <header className="mb-4 flex items-center gap-2">
          <Palette
            size={16}
            strokeWidth={1.8}
            style={{ color: 'var(--label-secondary)' }}
          />
          <h2
            id="settings-appearance-heading"
            className="text-headline"
            style={{ color: 'var(--label-primary)' }}
          >
            Apariencia
          </h2>
        </header>

        <Row label="Tema">
          <div
            className="relative inline-flex items-center rounded-full p-0.5"
            style={{ background: 'var(--fill-secondary)' }}
          >
            <span
              aria-hidden
              className="absolute left-0.5 top-0.5 h-7 w-16 rounded-full ease-macos [transition-duration:220ms] [transition-property:transform]"
              style={{
                background: 'var(--material-thick-light)',
                boxShadow: 'var(--shadow-control)',
                transform:
                  resolvedTheme === 'dark' ? 'translateX(100%)' : 'translateX(0)',
              }}
            />
            {(['light', 'dark'] as const).map((value) => {
              const active = resolvedTheme === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={[
                    'mc-interactive relative z-10 inline-flex h-7 w-16 items-center justify-center rounded-full text-callout',
                    active
                      ? 'text-[color:var(--label-primary)]'
                      : 'text-[color:var(--label-secondary)]',
                  ].join(' ')}
                >
                  {value === 'light' ? 'Claro' : 'Oscuro'}
                </button>
              )
            })}
          </div>
        </Row>

        <Row label="Acento">
          <div className="flex flex-wrap gap-2">
            {ACCENT_SWATCHES.map((swatch) => {
              const active = accent.toLowerCase() === swatch.value.toLowerCase()
              return (
                <button
                  key={swatch.value}
                  type="button"
                  aria-label={swatch.name}
                  onClick={() => setAccent(swatch.value)}
                  className="mc-interactive relative h-6 w-6 rounded-full hover:scale-110"
                  style={{
                    background: swatch.value,
                    boxShadow: active
                      ? `0 0 0 2px var(--label-quaternary), 0 0 0 4px ${swatch.value}`
                      : 'inset 0 0 0 0.5px rgba(0,0,0,0.15)',
                  }}
                />
              )
            })}
          </div>
        </Row>

        {/* Iter 2026-05-15: row "Ventana del MC" oculto en mobile a pedido del
            operador. En viewports < 768px el shell es full-bleed app-native sin
            Window flotante/expandida/fullscreen aplicable. El hook
            `useShellMode` sigue retornando data (preserva preferencia si el
            operador alterna con desktop), solo el control UI no renderea. */}
        {!isMobile && (
          <Row label="Ventana del MC">
            <div
              className="relative inline-flex items-center rounded-full p-0.5"
              style={{ background: 'var(--fill-secondary)' }}
            >
              <span
                aria-hidden
                className="absolute left-0.5 top-0.5 h-7 w-24 rounded-full ease-macos [transition-duration:220ms] [transition-property:transform]"
                style={{
                  background: 'var(--material-thick-light)',
                  boxShadow: 'var(--shadow-control)',
                  transform: `translateX(${shellModeIndex * 100}%)`,
                }}
              />
              {(
                [
                  { value: 'floating', label: 'Flotante' },
                  { value: 'expanded', label: 'Expandida' },
                  { value: 'fullscreen', label: 'Completa' },
                ] as const
              ).map(({ value, label }) => {
                const active = resolvedShellMode === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setShellMode(value)}
                    className={[
                      'mc-interactive relative z-10 inline-flex h-7 w-24 items-center justify-center rounded-full text-callout',
                      active
                        ? 'text-[color:var(--label-primary)]'
                        : 'text-[color:var(--label-secondary)]',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </Row>
        )}

        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="mc-interactive mt-1 flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-[color:var(--fill-secondary)]"
          aria-label="Abrir biblioteca de wallpapers"
        >
          <span
            className="text-callout"
            style={{ color: 'var(--label-secondary)' }}
          >
            Wallpaper
          </span>
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-7 w-16 rounded"
              style={{
                backgroundImage: activeWallpaperPreviewUrl
                  ? `url("${activeWallpaperPreviewUrl}")`
                  : undefined,
                backgroundColor: 'var(--fill-secondary)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.15)',
              }}
            />
            <ChevronRight
              size={14}
              strokeWidth={1.8}
              style={{ color: 'var(--label-tertiary)' }}
            />
          </span>
        </button>
      </section>

      <WallpaperLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span
        className="text-callout"
        style={{ color: 'var(--label-secondary)' }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}
