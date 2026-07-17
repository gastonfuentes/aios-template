'use client'

import { useEffect, useRef } from 'react'
import { useWallpaper } from '@/core/hooks/useWallpaper'

/**
 * Iter 2026-05-15 bugfix flash al ir a /settings: helper invisible que
 * encapsula el side effect de propagar el wallpaper activo al CSS var
 * `--wallpaper-url` sobre `<html>`. Vive como child de `<AppShell>` —
 * siempre montado en rutas autenticadas, por lo que el wallpaper se aplica
 * UNA vez al boot del shell y permanece estable cross-navegación.
 *
 * Antes (bug): el side effect vivía dentro del hook `useWallpaper.ts`, y
 * el ÚNICO consumer del hook era `AppearanceCard.tsx` (exclusivo de
 * `/settings`). Al navegar a `/settings`, el AppearanceCard se montaba, el
 * effect del hook corría por primera vez, y el `setProperty('--wallpaper-url', ...)`
 * disparaba un repaint que el browser interpretaba como "image source
 * changed", causando un flash negro de ~1s mientras el image se
 * re-decodificaba. Otros módulos no consumían el hook → no había mutación
 * de la CSS var → cero flash.
 *
 * Ahora: el side effect canónico vive aquí. AppearanceCard sigue
 * consumiendo `useWallpaper()` para la UI del picker, pero el `useEffect`
 * que setea la CSS var fue removido del hook (queda como data-only hook).
 * Solo el `WallpaperApplier` muta la CSS var, montado UNA vez en AppShell.
 *
 * El componente retorna `null` — no tiene UI, solo side effect.
 */
export function WallpaperApplier() {
  const { active } = useWallpaper()
  const currentObjectUrl = useRef<string | null>(null)

  useEffect(() => {
    let nextUrl: string
    if (active.kind === 'preset') {
      nextUrl = active.url
    } else {
      nextUrl = URL.createObjectURL(active.record.blob)
    }
    document.documentElement.style.setProperty('--wallpaper-url', `url("${nextUrl}")`)
    const previous = currentObjectUrl.current
    currentObjectUrl.current = active.kind === 'custom' ? nextUrl : null
    if (previous && previous !== nextUrl) {
      URL.revokeObjectURL(previous)
    }
    return () => {
      if (currentObjectUrl.current) {
        URL.revokeObjectURL(currentObjectUrl.current)
        currentObjectUrl.current = null
      }
    }
  }, [active])

  return null
}
