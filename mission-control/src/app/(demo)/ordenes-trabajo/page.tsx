import { WorkOrdersModule } from '@/features/work-orders/components/WorkOrdersModule'

/**
 * /ordenes-trabajo — órdenes de trabajo (Gannet demo).
 *
 * Server shell only; the auth gate lives in the `(app)` layout. The client
 * component reads its views through `/api/gannet/<view>`.
 */
export default function Page() {
  return <WorkOrdersModule />
}
