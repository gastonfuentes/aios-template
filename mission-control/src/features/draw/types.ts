/**
 * PRP-034 Sub-fase 4: types compartidos para Draw canvases.
 * Espejo del schema `public.draw_canvases`.
 */

export type DrawCanvas = {
  id: string
  title: string
  elements: unknown[] // Excalidraw element shape (no typear interno aquí)
  app_state: Record<string, unknown>
  files: Record<string, unknown>
  thumbnail_url: string | null
  owner_id: string
  created_at: string
  updated_at: string
}

export type DrawCanvasSummary = Pick<
  DrawCanvas,
  'id' | 'title' | 'thumbnail_url' | 'created_at' | 'updated_at'
>
