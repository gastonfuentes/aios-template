'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PenSquare, Trash2, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Modal } from '@/core/components/macos/Modal'
import type { DrawCanvasSummary } from '../types'

export function DrawList({
  initialCanvases,
}: {
  initialCanvases: DrawCanvasSummary[]
}) {
  const router = useRouter()
  const [canvases, setCanvases] = useState<DrawCanvasSummary[]>(initialCanvases)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DrawCanvasSummary | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const res = await fetch('/api/draw', { signal: ac.signal })
      if (!res.ok) return
      const body = (await res.json()) as { canvases: DrawCanvasSummary[] }
      if (!ac.signal.aborted) setCanvases(body.canvases)
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // PRP-035 iter post-cierre: el boton "Nuevo canvas" vive ahora en el
  // Toolbar global y dispatchea `aios:draw:new` al click. handleCreate
  // envuelto en useCallback con deps [creating, router] porque el listener
  // necesita la version mas reciente del closure (lee `creating` state +
  // `router` instance). El listener se re-registra cuando deps cambian
  // (creating false→true→false en un solo ciclo de create) — trivial,
  // cero ventana donde el listener este ausente (React batchea cleanup +
  // setup en un solo tick).
  const handleCreate = useCallback(async () => {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled' }),
      })
      if (res.ok) {
        const body = (await res.json()) as { canvas: DrawCanvasSummary }
        router.push(`/draw/${body.canvas.id}`)
      }
    } finally {
      setCreating(false)
    }
  }, [creating, router])

  useEffect(() => {
    const handler = () => {
      void handleCreate()
    }
    window.addEventListener('aios:draw:new', handler)
    return () => window.removeEventListener('aios:draw:new', handler)
  }, [handleCreate])

  async function performDelete(id: string) {
    await fetch(`/api/draw/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refresh()
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8">
      {canvases.length === 0 ? (
        <div
          className="mc-card flex flex-col items-center gap-3 rounded-card p-12 text-center"
          style={{ color: 'var(--label-tertiary)' }}
        >
          <PenSquare size={32} strokeWidth={1.5} />
          <p className="text-body">No hay canvases todavía.</p>
          <p className="text-callout normal-case" style={{ color: 'var(--label-tertiary)' }}>
            Crea uno manualmente, o pídele a agent un diagrama desde el chat.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {canvases.map((c) => (
            <article
              key={c.id}
              className="mc-card group relative rounded-card p-4"
            >
              <Link href={`/draw/${c.id}`} className="block">
                <div
                  className="mb-3 aspect-video rounded-md"
                  style={{
                    background: c.thumbnail_url
                      ? `url("${c.thumbnail_url}") center/cover`
                      : 'var(--fill-secondary)',
                  }}
                />
                <h3
                  className="truncate text-headline"
                  style={{ color: 'var(--label-primary)' }}
                >
                  {c.title}
                </h3>
                <p
                  className="text-caption2"
                  style={{ color: 'var(--label-tertiary)' }}
                >
                  Actualizado{' '}
                  {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => setDeleteTarget(c)}
                aria-label="Delete canvas"
                className="mc-interactive absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100"
                style={{
                  background: 'var(--material-thick-light)',
                  color: 'var(--sys-red)',
                }}
              >
                <Trash2 size={11} strokeWidth={1.8} />
              </button>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        label="Confirmar borrado de canvas"
        role="alertdialog"
        panelMaxWidth="420px"
        panelClassName="p-6"
      >
        {deleteTarget && (
          <>
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'rgba(255,69,58,0.15)',
                  color: 'var(--sys-red)',
                }}
              >
                <AlertTriangle size={20} strokeWidth={1.8} />
              </div>
              <h2 className="text-title2" style={{ color: 'var(--label-primary)' }}>
                ¿Borrar este canvas?
              </h2>
              <p
                className="text-callout normal-case"
                style={{ color: 'var(--label-secondary)' }}
              >
                <span style={{ color: 'var(--label-primary)' }}>{deleteTarget.title}</span>{' '}
                se borrará para siempre. No se puede deshacer.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="mc-interactive rounded-md px-4 py-2 text-callout"
                style={{
                  background: 'var(--fill-secondary)',
                  color: 'var(--label-primary)',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deleteTarget.id
                  setDeleteTarget(null)
                  void performDelete(id)
                }}
                className="mc-interactive rounded-md px-4 py-2 text-callout text-white"
                style={{ background: 'var(--sys-red)' }}
              >
                Borrar
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
