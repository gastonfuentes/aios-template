'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'aios-accent'
const DEFAULT_ACCENT = '#0A84FF'

const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  listeners.add(callback)
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) emit()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

function getServerSnapshot(): string {
  return DEFAULT_ACCENT
}

export function useAccent(): [string, (value: string) => void] {
  const accent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function setAccent(value: string) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      /* ignore */
    }
    emit()
  }

  return [accent, setAccent]
}
