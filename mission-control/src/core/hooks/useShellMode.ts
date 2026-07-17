'use client'

import { useSyncExternalStore } from 'react'

/**
 * PRP-036 iter post-cierre: el shell del MC tiene 3 modos discretos, no un
 * toggle binario floating/fullscreen. El operador eligió diferenciar
 * "expandida" (CSS edge-to-edge dentro del browser, browser chrome visible)
 * de "pantalla completa" (CSS edge-to-edge + Fullscreen API real que oculta
 * browser chrome). El menú del traffic light verde ofrece los 3 modes
 * explícitos en lugar de un toggle ambiguo.
 *
 *   - 'floating'    Default. Window centrada con padding 24px (wallpaper
 *                   visible en bordes) + border-radius 26 + shadow window.
 *   - 'expanded'    Window edge-to-edge dentro del viewport del browser
 *                   (padding 0 + radius 0 + shadow none). El browser chrome
 *                   (tabs, address bar, otros sites) sigue visible. NO se
 *                   invoca Fullscreen API.
 *   - 'fullscreen'  Mismo visual edge-to-edge del shell + INVOCA Fullscreen
 *                   API browser para ocultar el chrome del navegador. Skip
 *                   en PWA standalone (display-mode standalone) — el browser
 *                   chrome ya no existe ahí.
 *
 * Patrón canónico `useSyncExternalStore` + singleton `Set<() => void>`
 * listeners (espejo byte-exact de `useAccent.ts` PRP-020). N consumers
 * simultáneos sin Context Provider — el setter emite a todos los subscribers
 * en el mismo tick.
 *
 * Backward-compat: lee `localStorage['mc-fullscreen']` (PRP-036 original
 * key) si `mc-shell-mode` no existe — migra `'true' → 'fullscreen'`,
 * `'false' → 'floating'`. El primer setter limpia la key vieja.
 *
 * Source of truth: `localStorage['mc-shell-mode']`. El atributo
 * `data-shell-mode` sobre `<html>` es el espejo CSS que las reglas de
 * `globals.css` consumen.
 *
 * Cross-browser defensive (iter bugfix 2026-05-15):
 *   - Detecta y usa webkit-prefixed APIs (`webkitRequestFullscreen`,
 *     `webkitExitFullscreen`, `webkitFullscreenElement`, `webkitfullscreenchange`)
 *     como fallback para Safari pre-17.4 / WebKit-based browsers que aún no
 *     han adoptado el standard sin prefix.
 *   - Promise-based API tanto para standard como webkit (el wrap con
 *     `Promise.resolve(...)` garantiza shape uniforme).
 *
 * Reset semántico unilateral (iter bugfix 2026-05-15):
 *   - Cuando el browser sale del fullscreen via Esc / F11 / cualquier
 *     mecanismo unilateral, el shell vuelve a `'floating'` (NO `'expanded'`).
 *     El operador asocia "salí del fullscreen" con "volví al estado normal",
 *     no con un intermediate edge-to-edge que sigue ocultando el wallpaper.
 *     Si el operador quería `expanded`, lo elige explícitamente desde el menu.
 */
export type ShellMode = 'floating' | 'expanded' | 'fullscreen'

const STORAGE_KEY = 'mc-shell-mode'
const LEGACY_STORAGE_KEY = 'mc-fullscreen'

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function readLegacy(): ShellMode | null {
  try {
    const v = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (v === 'true') return 'fullscreen'
    if (v === 'false') return 'floating'
    return null
  } catch {
    return null
  }
}

function getSnapshot(): ShellMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'floating' || raw === 'expanded' || raw === 'fullscreen') {
      return raw
    }
    const legacy = readLegacy()
    if (legacy !== null) return legacy
    return 'floating'
  } catch {
    return 'floating'
  }
}

function getServerSnapshot(): ShellMode {
  return 'floating'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(display-mode: standalone)').matches
  } catch {
    return false
  }
}

// ─── Cross-browser Fullscreen API ────────────────────────────────────────────
// Safari pre-17.4 + algunos WebKit-based browsers usan prefijo `webkit`. El
// standard sin prefix vive en Chrome/Edge/Firefox/Safari 17.4+. Detectamos
// ambos para no fallar silenciosamente.

type FullscreenLikeDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
  webkitExitFullscreen?: () => Promise<void> | void
}

type FullscreenLikeElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function isFullscreenEnabled(): boolean {
  if (typeof document === 'undefined') return false
  const d = document as FullscreenLikeDocument
  return d.fullscreenEnabled === true || d.webkitFullscreenEnabled === true
}

function getCurrentFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  const d = document as FullscreenLikeDocument
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null
}

function requestFullscreenCompat(el: HTMLElement): Promise<void> {
  const e = el as FullscreenLikeElement
  if (typeof e.requestFullscreen === 'function') {
    return e.requestFullscreen()
  }
  if (typeof e.webkitRequestFullscreen === 'function') {
    return Promise.resolve(e.webkitRequestFullscreen())
  }
  return Promise.reject(new Error('requestFullscreen API not available'))
}

function exitFullscreenCompat(): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('document undefined'))
  }
  const d = document as FullscreenLikeDocument
  if (typeof d.exitFullscreen === 'function') {
    return d.exitFullscreen()
  }
  if (typeof d.webkitExitFullscreen === 'function') {
    return Promise.resolve(d.webkitExitFullscreen())
  }
  return Promise.reject(new Error('exitFullscreen API not available'))
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  listeners.add(callback)

  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === LEGACY_STORAGE_KEY) emit()
  }

  // Si el browser sale de fullscreen real unilateralmente (Esc / F11 / browser
  // gesture), nuestro state local probablemente sigue 'fullscreen'. Lo
  // resetamos a 'floating' — el operador asocia "salir del fullscreen" con
  // "volver al estado normal", NO con quedarse en intermediate edge-to-edge.
  function onFullscreenChange() {
    if (typeof document === 'undefined') return
    const browserFullscreen = !!getCurrentFullscreenElement()
    const localMode = getSnapshot()
    if (!browserFullscreen && localMode === 'fullscreen') {
      try {
        window.localStorage.setItem(STORAGE_KEY, 'floating')
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.shellMode = 'floating'
      emit()
    }
  }

  window.addEventListener('storage', onStorage)
  // Standard + webkit prefix para cross-browser completo (Safari pre-17.4)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('webkitfullscreenchange', onFullscreenChange)

  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
    document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  }
}

async function applyBrowserFullscreen(mode: ShellMode): Promise<void> {
  if (typeof document === 'undefined') return
  if (!isFullscreenEnabled()) return
  if (isStandalone()) return

  const inBrowserFullscreen = !!getCurrentFullscreenElement()

  try {
    if (mode === 'fullscreen' && !inBrowserFullscreen) {
      await requestFullscreenCompat(document.documentElement)
    } else if (mode !== 'fullscreen' && inBrowserFullscreen) {
      await exitFullscreenCompat()
    }
  } catch (err) {
    console.warn('[useShellMode] fullscreen API rejected:', err)
  }
}

export function useShellMode(): [ShellMode, (mode: ShellMode) => void] {
  const mode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  )

  function setMode(next: ShellMode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.shellMode = next
    }
    // Fire-and-forget — la API es async pero el setter no awaitea. Si rechaza,
    // el .catch interno logea sin bloquear el flujo del usuario. El CSS state
    // (data-shell-mode + className) ya cambió, así que el operador ve el
    // efecto visual aunque la API no pueda completarse.
    void applyBrowserFullscreen(next)
    emit()
  }

  return [mode, setMode]
}
