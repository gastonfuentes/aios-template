import { ExecutiveDashboard } from '@/features/executive-dashboard/components/ExecutiveDashboard'

/**
 * /dashboard-ejecutivo — dashboard ejecutivo (Gannet demo).
 *
 * Server shell only; the auth gate lives in the `(app)` layout. The client
 * component reads its views through `/api/gannet/<view>`.
 */
export default function Page() {
  return <ExecutiveDashboard />
}
