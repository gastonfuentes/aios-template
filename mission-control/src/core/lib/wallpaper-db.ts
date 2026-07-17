// IndexedDB CRUD para wallpapers custom subidos por el operador.
// objectStore "wallpapers" con keyPath "id". Records { id, name, mime, blob, createdAt }.

const DB_NAME = 'aios-mc'
const DB_VERSION = 1
const STORE = 'wallpapers'

export type CustomWallpaperRecord = {
  id: string
  name: string
  mime: string
  blob: Blob
  createdAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible en este entorno'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'))
  })
}

export async function listCustomWallpapers(): Promise<CustomWallpaperRecord[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const rows = (req.result as CustomWallpaperRecord[]) ?? []
      rows.sort((a, b) => b.createdAt - a.createdAt)
      resolve(rows)
    }
    req.onerror = () => reject(req.error ?? new Error('listCustomWallpapers failed'))
  })
}

export async function addCustomWallpaper(
  blob: Blob,
  name: string
): Promise<CustomWallpaperRecord> {
  const record: CustomWallpaperRecord = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name || 'Wallpaper',
    mime: blob.type || 'image/jpeg',
    blob,
    createdAt: Date.now(),
  }
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.add(record)
    req.onsuccess = () => resolve(record)
    req.onerror = () => reject(req.error ?? new Error('addCustomWallpaper failed'))
  })
}

export async function getCustomWallpaper(
  id: string
): Promise<CustomWallpaperRecord | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get(id)
    req.onsuccess = () => resolve((req.result as CustomWallpaperRecord | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('getCustomWallpaper failed'))
  })
}

export async function removeCustomWallpaper(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('removeCustomWallpaper failed'))
  })
}
