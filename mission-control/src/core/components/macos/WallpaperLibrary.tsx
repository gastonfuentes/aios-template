'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react'
import { Image as ImageIcon, Trash2, Upload, X } from 'lucide-react'
import { useWallpaper, type WallpaperEntry } from '@/core/hooks/useWallpaper'
import { Modal } from './Modal'

const ACCEPT_MIME = 'image/*'
const MAX_BYTES = 20 * 1024 * 1024 // 20 MB cap razonable para IndexedDB cross-browser

export function WallpaperLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { library, activeId, setActive, upload, removeCustom } = useWallpaper()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen excede 20 MB. Usa una mas liviana.')
      return
    }
    try {
      setBusy(true)
      await upload(file, file.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la imagen.')
    } finally {
      setBusy(false)
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragOver(false)
    void handleFiles(event.dataTransfer?.files ?? null)
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!dragOver) setDragOver(true)
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (dragOver) setDragOver(false)
  }

  function onPickerChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files)
    event.target.value = ''
  }

  function browseFile() {
    fileInputRef.current?.click()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Wallpaper Library"
      role="dialog"
      panelMaxWidth="640px"
      panelClassName="relative p-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="mc-interactive absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--label-secondary)] hover:bg-[color:var(--fill-secondary)] hover:text-[color:var(--label-primary)]"
      >
        <X size={14} strokeWidth={1.8} />
      </button>

        <header className="mb-4">
          <h2 className="text-title2" style={{ color: 'var(--label-primary)' }}>
            Wallpaper
          </h2>
          <p className="mt-1 text-body" style={{ color: 'var(--label-secondary)' }}>
            Arrastra una imagen aqui o elige una de tu biblioteca.
          </p>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_MIME}
          onChange={onPickerChange}
          hidden
        />

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={browseFile}
          role="button"
          tabIndex={0}
          aria-label="Drop image or click to browse"
          className="mc-interactive-soft mb-4 flex h-32 cursor-pointer flex-col items-center justify-center rounded-card text-center text-[color:var(--label-secondary)]"
          style={{
            border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--separator)'}`,
            background: dragOver ? 'var(--fill-secondary)' : 'transparent',
          }}
        >
          <Upload
            size={20}
            strokeWidth={1.6}
            style={{ color: dragOver ? 'var(--accent)' : 'var(--label-tertiary)' }}
          />
          <p className="mt-2 text-body">
            {busy
              ? 'Guardando…'
              : dragOver
                ? 'Suelta la imagen aqui'
                : 'Arrastra una imagen o haz clic para buscar'}
          </p>
          <p className="mt-0.5 text-callout" style={{ color: 'var(--label-tertiary)' }}>
            PNG · JPG · WEBP — hasta 20 MB
          </p>
        </div>

        {error && (
          <p
            className="mb-3 text-callout"
            style={{ color: 'var(--sys-red)' }}
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="text-caption2 mb-2 px-1">Library</div>
        <div className="grid grid-cols-4 gap-3">
          {library.map((entry) => (
            <WallpaperTile
              key={entry.id}
              entry={entry}
              active={entry.id === activeId}
              onSelect={() => {
                setActive(entry.id)
              }}
              onRemove={
                entry.kind === 'custom'
                  ? () => {
                      void removeCustom(entry.id)
                    }
                  : undefined
              }
            />
          ))}
        </div>
    </Modal>
  )
}

function WallpaperTile({
  entry,
  active,
  onSelect,
  onRemove,
}: {
  entry: WallpaperEntry
  active: boolean
  onSelect: () => void
  onRemove?: () => void
}) {
  // Derive preview URL from entry. For custom blobs, useMemo creates the
  // ObjectURL once per entry change; useEffect cleanup revokes the previous one
  // on swap or unmount (side effect to platform API, no setState involved).
  const previewUrl = useMemo<string>(
    () =>
      entry.kind === 'preset'
        ? entry.url
        : URL.createObjectURL(entry.record.blob),
    [entry]
  )
  const previousObjectUrl = useRef<string | null>(null)

  useEffect(() => {
    const prev = previousObjectUrl.current
    previousObjectUrl.current = entry.kind === 'custom' ? previewUrl : null
    if (prev && prev !== previewUrl) {
      URL.revokeObjectURL(prev)
    }
    return () => {
      if (previousObjectUrl.current) {
        URL.revokeObjectURL(previousObjectUrl.current)
        previousObjectUrl.current = null
      }
    }
  }, [entry, previewUrl])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Apply wallpaper ${entry.name}`}
        aria-pressed={active}
        className="mc-interactive relative block aspect-video w-full overflow-hidden rounded-card hover:scale-[1.03]"
        style={{
          backgroundImage: previewUrl ? `url("${previewUrl}")` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: 'var(--fill-secondary)',
          boxShadow: active
            ? `0 0 0 2px var(--label-quaternary), 0 0 0 3.5px var(--accent)`
            : 'inset 0 0 0 0.5px rgba(0,0,0,0.20)',
        }}
      >
        {!previewUrl && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'var(--label-tertiary)' }}
          >
            <ImageIcon size={20} strokeWidth={1.5} />
          </span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          aria-label={`Remove ${entry.name}`}
          className="mc-interactive absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{
            background: 'var(--material-thick-light)',
            color: 'var(--label-secondary)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          <Trash2 size={11} strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}
