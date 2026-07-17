// Singleton store de la librería de wallpapers + estado del activo.
// El cache de customs se hidrata async desde IndexedDB en el primer subscribe.
// El active id vive en localStorage con sync via `storage` event (cross-tab).

import {
  addCustomWallpaper,
  listCustomWallpapers,
  removeCustomWallpaper,
  type CustomWallpaperRecord,
} from '@/core/lib/wallpaper-db'

export type PresetWallpaper = {
  readonly kind: 'preset'
  readonly id: string
  readonly name: string
  readonly url: string
}

export type CustomWallpaper = {
  readonly kind: 'custom'
  readonly id: string
  readonly name: string
  readonly record: CustomWallpaperRecord
}

export type Wallpaper = PresetWallpaper | CustomWallpaper

export const DEFAULT_ID = 'preset-default'
const ACTIVE_STORAGE_KEY = 'aios-wallpaper-id'

export const PRESETS: readonly PresetWallpaper[] = [
  { kind: 'preset', id: DEFAULT_ID, name: 'Default', url: '/wallpaper.jpg' },
] as const

// ─── Custom list cache + subscription ─────────────────────────────────────────

const EMPTY_CUSTOM_LIST: readonly CustomWallpaperRecord[] = []
let customCache: readonly CustomWallpaperRecord[] = EMPTY_CUSTOM_LIST
let hydrated = false
let hydrating: Promise<void> | null = null
const customListeners = new Set<() => void>()

function emitCustoms() {
  for (const l of customListeners) l()
}

async function hydrate(): Promise<void> {
  if (hydrated) return
  if (hydrating) return hydrating
  hydrating = (async () => {
    try {
      const rows = await listCustomWallpapers()
      customCache = rows
    } catch {
      customCache = EMPTY_CUSTOM_LIST
    } finally {
      hydrated = true
      hydrating = null
      emitCustoms()
    }
  })()
  return hydrating
}

export function subscribeCustomWallpapers(callback: () => void): () => void {
  customListeners.add(callback)
  // Trigger hydration lazily on first subscribe (browser-only).
  if (typeof window !== 'undefined') {
    void hydrate()
  }
  return () => {
    customListeners.delete(callback)
  }
}

export function getCustomWallpapersSnapshot(): readonly CustomWallpaperRecord[] {
  return customCache
}

export function getCustomWallpapersServerSnapshot(): readonly CustomWallpaperRecord[] {
  return EMPTY_CUSTOM_LIST
}

export async function uploadCustomWallpaper(
  file: File | Blob,
  name?: string
): Promise<CustomWallpaperRecord> {
  const record = await addCustomWallpaper(file, name ?? (file instanceof File ? file.name : 'Wallpaper'))
  customCache = [record, ...customCache]
  emitCustoms()
  return record
}

export async function deleteCustomWallpaper(id: string): Promise<void> {
  await removeCustomWallpaper(id)
  customCache = customCache.filter((r) => r.id !== id)
  emitCustoms()
}

// ─── Active id (localStorage) ─────────────────────────────────────────────────

const activeListeners = new Set<() => void>()

function emitActive() {
  for (const l of activeListeners) l()
}

export function subscribeActiveWallpaperId(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  activeListeners.add(callback)
  function onStorage(event: StorageEvent) {
    if (event.key === ACTIVE_STORAGE_KEY) emitActive()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    activeListeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

export function getActiveWallpaperIdSnapshot(): string {
  try {
    return window.localStorage.getItem(ACTIVE_STORAGE_KEY) ?? DEFAULT_ID
  } catch {
    return DEFAULT_ID
  }
}

export function getActiveWallpaperIdServerSnapshot(): string {
  return DEFAULT_ID
}

export function setActiveWallpaperId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
  emitActive()
}
