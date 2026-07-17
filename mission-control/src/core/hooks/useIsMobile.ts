'use client'

import { useSyncExternalStore } from 'react'

// Mismo breakpoint que el override CSS del apendice PWA en globals.css y que
// el discriminador desktop/mobile de Tailwind `md:` (768px). Mantener en sync
// si alguno se mueve.
const MOBILE_QUERY = '(max-width: 767.98px)'

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

// SSR default: desktop. El cliente rehidrata con matchMedia real en el primer
// commit. En PWA standalone iOS el primer paint puede mostrar shell desktop
// 1 frame antes de rehidratar — aceptable (next-themes hace lo mismo con
// suppressHydrationWarning y el operador valida visualmente).
function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
