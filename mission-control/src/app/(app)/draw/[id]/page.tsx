import { notFound } from 'next/navigation'
import { createClient } from '@/core/adapters/supabase/server'
import { DrawCanvas } from '@/features/draw/components/DrawCanvas'
import type { DrawCanvas as CanvasRow } from '@/features/draw/types'

/**
 * PRP-034 Sub-fase 4: /draw/[id] — canvas individual con Excalidraw.
 *
 * Server Component que hidrata el canvas via SSR (RLS owner-only filtra cross-user).
 * Pasa el shape completo al Client wrapper que monta Excalidraw nativo.
 */
export default async function DrawCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('draw_canvases')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error || !data) {
    notFound()
  }

  return (
    <div className="h-full">
      <DrawCanvas canvas={data as CanvasRow} />
    </div>
  )
}
