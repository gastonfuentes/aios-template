import { OpsStream } from '@/features/ops/components/OpsStream'

/**
 * PRP-034 Sub-fase 3: /ops — stream SSE en vivo del daemon.
 *
 * Server shell (auth gate por layout). Client component consume
 * `/api/ops/stream` (proxy SSE Node runtime) + `/api/ops/recent?limit=200`
 * para el backfill.
 */
export default function OpsPage() {
  return <OpsStream />
}
