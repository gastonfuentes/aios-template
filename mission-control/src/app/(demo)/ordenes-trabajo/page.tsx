import { Suspense } from 'react'
import { WorkOrdersModule } from '@/features/work-orders/components/WorkOrdersModule'

/**
 * /ordenes-trabajo — órdenes de trabajo (Gannet demo).
 *
 * Server shell only; the auth gate lives in the `(app)` layout. The client
 * component reads its views through `/api/gannet/<view>`.
 *
 * The Suspense boundary is required, not stylistic: the module calls
 * `useSearchParams` to read the `?cliente=` drill-down filter pushed by the
 * executive dashboard, and Next refuses to prerender a route that reads search
 * params outside a boundary.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkOrdersModule />
    </Suspense>
  )
}
