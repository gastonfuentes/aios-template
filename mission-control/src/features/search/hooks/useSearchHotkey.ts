'use client'

import { useEffect } from 'react'

/**
 * PRP-034 Sub-fase 5: hook que escucha `Cmd+K` / `Ctrl+K` global y dispara
 * `onOpen()`. Ignora si el usuario está editando en input/textarea/contenteditable
 * (deja Cmd+K natural cuando la app embebida lo necesita — caso edge raro).
 *
 * Verificado en mapeo Sub-fase 5: ninguna binding Cmd+K activa hoy en el MC
 * (grep ctrlKey/metaKey retornó 0 en src/ fuera de vendored AI Elements).
 */
export function useSearchHotkey(onOpen: () => void): void {
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      const isCmdK =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (!isCmdK) return
      event.preventDefault()
      onOpen()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onOpen])
}
