import { IaModule } from '@/features/gannet-ia/components/IaModule'

/**
 * /ia — asistente Gannet (Gannet demo, módulo 13).
 *
 * Server shell only; this route is public through the `(demo)` group with no
 * auth gate. Stage 1 answers deterministically from the `gd_*` views — no model
 * is wired. The client component posts to `/api/gannet/ask`.
 */
export default function Page() {
  return <IaModule />
}
