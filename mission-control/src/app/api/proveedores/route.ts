/**
 * GET /api/proveedores — resumen por rubro + actividad reciente (demo).
 *
 * Lee las vistas públicas `demo_resumen_rubros` y `demo_proveedor_actividad`
 * (granted a anon/authenticated, sin RLS) vía el server client estándar —
 * mismo patrón que /api/notifications, sin service role.
 *
 * La actividad sale de `demo_proveedor_actividad` (no de `demo_actividad_reciente`)
 * porque esa vista sí expone `proveedor_id`, que es lo que habilita el drill-down
 * al panel de detalle sin joinear por nombre.
 *
 * Acepta `?rubro=` opcional para el filtro de drill-down. El filtro también se
 * aplica en cliente; validarlo acá evita que un valor arbitrario llegue a la query.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/core/adapters/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RubroSchema = z.enum(['gas', 'transporte', 'personal', 'obras'])

export async function GET(req: Request): Promise<Response> {
  const supabase = await createClient()

  const rubroParam = new URL(req.url).searchParams.get('rubro')
  const parsedRubro = RubroSchema.safeParse(rubroParam)
  if (rubroParam !== null && !parsedRubro.success) {
    return NextResponse.json(
      { resumen: [], actividad: [], error: 'Rubro inválido.' },
      { status: 400 },
    )
  }

  // `demo_resumen_rubros` aporta el conteo de registros. El importe por rubro se
  // recalcula desde `demo_proveedor_detalle` porque esa vista ya aplica la
  // política honesta de montos: obras agrega el presupuesto del último avance de
  // cada obra (el resumen suma una fila por avance y cuenta la misma obra varias
  // veces) y personal queda en null por no tener columna de monto.
  let actividadQuery = supabase
    .from('demo_proveedor_actividad')
    .select('proveedor_id, proveedor, rubro, fecha, detalle, cantidad, unidad, monto, estado')
    .order('fecha', { ascending: false })
    .limit(15)

  if (parsedRubro.success) {
    actividadQuery = actividadQuery.eq('rubro', parsedRubro.data)
  }

  const [resumenRes, actividadRes, montosRes] = await Promise.all([
    supabase.from('demo_resumen_rubros').select('rubro, registros, total_ars'),
    actividadQuery,
    supabase.from('demo_proveedor_detalle').select('rubro, monto_total_ars'),
  ])

  const error = resumenRes.error ?? actividadRes.error ?? montosRes.error
  if (error) {
    return NextResponse.json(
      { resumen: [], actividad: [], error: error.message },
      { status: 500 },
    )
  }

  const montoPorRubro = new Map<string, number | null>()
  for (const fila of montosRes.data ?? []) {
    if (fila.monto_total_ars === null) continue
    montoPorRubro.set(fila.rubro, (montoPorRubro.get(fila.rubro) ?? 0) + Number(fila.monto_total_ars))
  }

  const resumen = (resumenRes.data ?? []).map((fila) => ({
    ...fila,
    total_ars: montoPorRubro.get(fila.rubro) ?? null,
  }))

  return NextResponse.json({
    resumen,
    actividad: actividadRes.data ?? [],
  })
}
