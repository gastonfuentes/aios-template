import { ScheduledList } from '@/features/scheduled/components/ScheduledList'

/**
 * PRP-034 Sub-fase 2: /scheduled — listado de cron jobs del daemon.
 *
 * Server Component shell (auth gate por `(app)/layout.tsx`). El listado vivo
 * lo gestiona el Client component `<ScheduledList>` que consume
 * `/api/scheduled/*` (proxy MC → daemon `/schedule/*`).
 */
export default function ScheduledPage() {
  return <ScheduledList />
}
