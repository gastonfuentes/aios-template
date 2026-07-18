import { ProveedoresDashboard } from '@/features/proveedores/components/ProveedoresDashboard'

/**
 * /proveedores — panel de proveedores (demo congreso minero).
 *
 * Server shell (auth gate por layout). Client component consume
 * `/api/proveedores` para el resumen por rubro + actividad reciente.
 */
export default function ProveedoresPage() {
  return <ProveedoresDashboard />
}
