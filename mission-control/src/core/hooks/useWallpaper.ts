'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  DEFAULT_ID,
  PRESETS,
  deleteCustomWallpaper,
  getActiveWallpaperIdServerSnapshot,
  getActiveWallpaperIdSnapshot,
  getCustomWallpapersServerSnapshot,
  getCustomWallpapersSnapshot,
  setActiveWallpaperId,
  subscribeActiveWallpaperId,
  subscribeCustomWallpapers,
  uploadCustomWallpaper,
  type CustomWallpaper,
  type PresetWallpaper,
} from '@/core/lib/wallpaper-store'
import type { CustomWallpaperRecord } from '@/core/lib/wallpaper-db'

export type WallpaperEntry = PresetWallpaper | CustomWallpaper

function recordToCustom(record: CustomWallpaperRecord): CustomWallpaper {
  return { kind: 'custom', id: record.id, name: record.name, record }
}

export type UseWallpaperReturn = {
  library: readonly WallpaperEntry[]
  active: WallpaperEntry
  activeId: string
  setActive: (id: string) => void
  upload: (file: File | Blob, name?: string) => Promise<void>
  removeCustom: (id: string) => Promise<void>
}

/**
 * Data-only hook (iter 2026-05-15 bugfix flash al ir a /settings): retorna el
 * estado del wallpaper (library + active + setters) SIN side effects. La
 * propagación del wallpaper activo a la CSS var `--wallpaper-url` vive en
 * el componente helper `<WallpaperApplier />` que se monta en `<AppShell>`,
 * único responsable del side effect. Esto evita que cada consumer del hook
 * dispare repaints redundantes del CSS var (caso real: AppearanceCard se
 * montaba al entrar a /settings, el effect interno del hook corría por
 * primera vez, browser interpretaba la mutación como "image changed",
 * disparaba un flash negro de ~1s mientras re-decodificaba).
 *
 * Si emerge una segunda superficie que necesita sync con el wallpaper
 * activo (ej. preview en otro card de Settings), consume este hook para
 * data y deja el side effect canónico a `<WallpaperApplier />`.
 */
export function useWallpaper(): UseWallpaperReturn {
  const activeId = useSyncExternalStore(
    subscribeActiveWallpaperId,
    getActiveWallpaperIdSnapshot,
    getActiveWallpaperIdServerSnapshot
  )
  const customRecords = useSyncExternalStore(
    subscribeCustomWallpapers,
    getCustomWallpapersSnapshot,
    getCustomWallpapersServerSnapshot
  )

  const library = useMemo<readonly WallpaperEntry[]>(
    () => [...PRESETS, ...customRecords.map(recordToCustom)],
    [customRecords]
  )

  const active = useMemo<WallpaperEntry>(
    () => library.find((w) => w.id === activeId) ?? PRESETS[0],
    [library, activeId]
  )

  return {
    library,
    active,
    activeId,
    setActive: (id) => {
      setActiveWallpaperId(id)
    },
    upload: async (file, name) => {
      const record = await uploadCustomWallpaper(file, name)
      setActiveWallpaperId(record.id)
    },
    removeCustom: async (id) => {
      await deleteCustomWallpaper(id)
      // If we removed the active wallpaper, fall back to default.
      try {
        const current = window.localStorage.getItem('aios-wallpaper-id')
        if (current === id) {
          setActiveWallpaperId(DEFAULT_ID)
        }
      } catch {
        /* ignore */
      }
    },
  }
}
