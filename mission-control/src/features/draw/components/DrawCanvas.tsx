'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import '@excalidraw/excalidraw/index.css'
import type { DrawCanvas } from '../types'

/**
 * PRP-034 Sub-fase 4: wrapper Excalidraw + auto-save debounced 800ms.
 *
 * `@excalidraw/excalidraw@0.18.1` accede a `window` en boot — dynamic import
 * con `ssr: false` es obligatorio. Patrón canónico Excalidraw + Next.js App
 * Router (peerDependencies confirmadas compat React 19).
 *
 * `excalidrawAPI={(api) => ...}` callback retorna ImperativeAPI (no `ref` —
 * removido en 0.17). Lo capturamos en ref local para futuras operaciones
 * imperativas (no usadas hoy pero arquitectura preparada).
 */
const Excalidraw = dynamic(
  () => import('@excalidraw/excalidraw').then((mod) => mod.Excalidraw),
  { ssr: false, loading: () => <CanvasLoading /> },
)

function CanvasLoading() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: 'var(--fill-secondary)', color: 'var(--label-tertiary)' }}
    >
      Cargando lienzo…
    </div>
  )
}

type ExcalidrawSceneState = {
  elements: readonly unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown>
}

/**
 * Campos del appState que Excalidraw reconstruye internamente como Map/Set y
 * que NO toleran ser hidratados desde JSON plain (rompen `forEach`/`has`).
 * Lista derivada empíricamente del bug detectado en E2E + docs canónicas:
 * https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata
 */
const VOLATILE_APP_STATE_KEYS = new Set([
  'collaborators',
  'selectedElementIds',
  'previousSelectedElementIds',
  'selectedGroupIds',
  'editingGroupId',
  'editingElement',
  'editingTextElement',
  'editingLinearElement',
  'selectedLinearElement',
  'draggingElement',
  'resizingElement',
  'multiElement',
  'pasteDialog',
  'snapLines',
  'isLoading',
  'isResizing',
  'isRotating',
  'errorMessage',
  'cursorButton',
])

function sanitizeAppState(
  raw: unknown,
  theme: 'light' | 'dark',
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') {
    return { theme, viewBackgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }
  }
  const entries = Object.entries(raw as Record<string, unknown>).filter(
    ([key]) => !VOLATILE_APP_STATE_KEYS.has(key),
  )
  return { ...Object.fromEntries(entries), theme }
}

export function DrawCanvas({
  canvas,
  onTitleChange,
}: {
  canvas: DrawCanvas
  onTitleChange?: (title: string) => void
}) {
  // PRP-034 iter post-cierre: tema del lienzo heredado de next-themes.
  // Excalidraw acepta `theme: 'light' | 'dark'` y maneja la conversión de
  // colores internos automáticamente. `theme ?? 'dark'` por consistencia
  // con `defaultTheme: 'dark'` del ThemeProvider en (app)/layout.
  const { resolvedTheme } = useTheme()
  const excalidrawTheme: 'light' | 'dark' = resolvedTheme === 'light' ? 'light' : 'dark'

  const [title, setTitle] = useState(canvas.title)
  const [savedAt, setSavedAt] = useState<Date | null>(new Date(canvas.updated_at))
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerialized = useRef<string>(
    JSON.stringify({
      elements: canvas.elements,
      appState: canvas.app_state,
      files: canvas.files,
    }),
  )

  const persist = useCallback(
    async (state: ExcalidrawSceneState) => {
      // Filtramos los volátiles ANTES de serializar — así DB queda limpia +
      // round-trip futuro no necesita re-sanitización en hidratación.
      const cleanAppState: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(state.appState)) {
        if (!VOLATILE_APP_STATE_KEYS.has(k)) cleanAppState[k] = v
      }
      const serialized = JSON.stringify({
        elements: state.elements,
        appState: cleanAppState,
        files: state.files,
      })
      if (serialized === lastSerialized.current) return
      lastSerialized.current = serialized
      setSaving(true)
      try {
        const res = await fetch(`/api/draw/${encodeURIComponent(canvas.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            elements: state.elements,
            app_state: cleanAppState,
            files: state.files,
          }),
        })
        if (res.ok) setSavedAt(new Date())
      } finally {
        setSaving(false)
      }
    },
    [canvas.id],
  )

  // Excalidraw 0.18 onChange firma con tipos internos (OrderedExcalidrawElement,
  // AppState, BinaryFiles). Usamos firma generica `(...args: unknown[])` para
  // evitar acoplar al modelo interno; persistimos los 3 args raw a Supabase JSONB.
  const handleChange = useCallback(
    (...args: unknown[]) => {
      const [elements, appState, files] = args as [
        readonly unknown[],
        Record<string, unknown>,
        Record<string, unknown>,
      ]
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        void persist({ elements, appState, files })
      }, 800)
    },
    [persist],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  async function handleTitleBlur() {
    if (title === canvas.title) return
    setSaving(true)
    try {
      const res = await fetch(`/api/draw/${encodeURIComponent(canvas.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (res.ok) {
        setSavedAt(new Date())
        onTitleChange?.(title)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <header
        className="hairline-b flex items-center justify-between gap-3 px-4 py-2"
        style={{ background: 'var(--material-thin-light)' }}
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void handleTitleBlur()}
          className="flex-1 bg-transparent text-headline outline-none"
          style={{ color: 'var(--label-primary)' }}
        />
        <span
          className="text-caption2"
          style={{ color: 'var(--label-tertiary)' }}
        >
          {saving
            ? 'Guardando…'
            : savedAt
              ? `Guardado ${savedAt.toLocaleTimeString()}`
              : 'Listo'}
        </span>
      </header>
      <div className="flex-1">
        <Excalidraw
          theme={excalidrawTheme}
          initialData={{
            elements: canvas.elements as never,
            // Sanitizamos el appState antes de hidratar Excalidraw: filtramos
            // campos volátiles que el lib reconstruye internamente como Map o
            // Set (`collaborators` Map, `selectedElementIds` Record, etc.) —
            // al serializar a Supabase JSONB quedan como `{}` plain object y
            // Excalidraw los procesa con `.forEach()` esperando Map, lo cual
            // explota con `TypeError: forEach is not a function`. La solución
            // canónica de la docs Excalidraw es usar `serializeAsJSON` que ya
            // filtra estos campos, pero como persistimos el appState raw,
            // filtramos los volátiles aquí antes de hidratar.
            appState: sanitizeAppState(canvas.app_state, excalidrawTheme) as never,
            files: canvas.files as never,
            scrollToContent: true,
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={handleChange as any}
        />
      </div>
    </div>
  )
}
