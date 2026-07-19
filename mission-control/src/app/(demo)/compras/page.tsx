import { PurchasingModule } from '@/features/purchasing/components/PurchasingModule'

/**
 * /compras — compras (Gannet demo).
 *
 * Server shell only; the auth gate lives in the `(app)` layout. The client
 * component reads its views through `/api/gannet/<view>`.
 */
export default function Page() {
  return <PurchasingModule />
}
