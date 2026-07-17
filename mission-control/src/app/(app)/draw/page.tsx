import { createClient } from '@/core/adapters/supabase/server'
import { DrawList } from '@/features/draw/components/DrawList'
import type { DrawCanvasSummary } from '@/features/draw/types'

/**
 * PRP-034 Sub-fase 4: /draw — listado de canvases.
 *
 * Server Component que hidrata la lista vía Supabase SSR (RLS owner-only).
 * El Client `<DrawList>` maneja create/delete/navigate sin SSR adicional.
 */
export default async function DrawIndexPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('draw_canvases')
    .select('id, title, thumbnail_url, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(200)
  const canvases = (data ?? []) as DrawCanvasSummary[]

  return <DrawList initialCanvases={canvases} />
}
