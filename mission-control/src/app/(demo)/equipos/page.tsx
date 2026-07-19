import { EquipmentModule } from '@/features/equipment/components/EquipmentModule'

/**
 * /equipos — equipos y herramientas (Gannet demo).
 *
 * Server shell only; the auth gate lives in the `(app)` layout. The client
 * component reads its views through `/api/gannet/<view>`.
 */
export default function Page() {
  return <EquipmentModule />
}
