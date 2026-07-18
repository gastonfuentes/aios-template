/**
 * GET /api/proveedores/:id — ficha agregada + actividad reciente de un proveedor.
 *
 * Lee `demo_proveedor_detalle` y `demo_proveedor_actividad` (ambas granted a
 * anon/authenticated con SELECT únicamente) vía el server client estándar, sin
 * service role — mismo patrón que la ruta padre.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/core/adapters/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** El id llega como string por la URL; se valida y se coacciona a entero positivo. */
const IdSchema = z.coerce.number().int().positive()

const DETALLE_COLUMNS =
  'proveedor_id, proveedor, rubro, cuit, contacto, email, activo, actividades_total, ' +
  'actividades_mes, actividades_mes_anterior, monto_total_ars, monto_mes_ars, ' +
  'ultima_actividad, dias_sin_actividad, actividades_ok, actividades_en_curso, ' +
  'actividades_alerta, estado_operativo, cantidad_total, cantidad_unidad, ' +
  'obras_en_cartera, avance_promedio'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  const parsed = IdSchema.safeParse(id)
  if (!parsed.success) {
    return NextResponse.json(
      { detalle: null, actividad: [], error: 'Identificador de proveedor inválido.' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const proveedorId = parsed.data

  const [detalleRes, actividadRes] = await Promise.all([
    supabase
      .from('demo_proveedor_detalle')
      .select(DETALLE_COLUMNS)
      .eq('proveedor_id', proveedorId)
      .maybeSingle(),
    supabase
      .from('demo_proveedor_actividad')
      .select('proveedor_id, proveedor, rubro, fecha, detalle, cantidad, unidad, monto, estado')
      .eq('proveedor_id', proveedorId)
      .order('fecha', { ascending: false })
      .limit(20),
  ])

  const error = detalleRes.error ?? actividadRes.error
  if (error) {
    return NextResponse.json(
      { detalle: null, actividad: [], error: error.message },
      { status: 500 },
    )
  }

  if (!detalleRes.data) {
    return NextResponse.json(
      { detalle: null, actividad: [], error: 'Proveedor no encontrado.' },
      { status: 404 },
    )
  }

  return NextResponse.json({
    detalle: detalleRes.data,
    actividad: actividadRes.data ?? [],
  })
}
