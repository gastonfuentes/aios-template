import { HrModule } from '@/features/hr/components/HrModule'

/**
 * /rrhh — recursos humanos (Gannet demo).
 *
 * Server shell only; the auth gate lives in the `(app)` layout. The client
 * component reads its views through `/api/gannet/<view>`.
 */
export default function Page() {
  return <HrModule />
}
