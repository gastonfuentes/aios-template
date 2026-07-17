import { createClient } from '@/core/adapters/supabase/server'
import { getRoleForEmail } from '@/core/config/auth'
import { ProfileCard } from '@/features/settings/components/ProfileCard'
import { AppearanceCard } from '@/features/settings/components/AppearanceCard'
import { NotificationsCard } from '@/features/settings/components/NotificationsCard'
import { IntegrationsCard } from '@/features/settings/components/IntegrationsCard'
import { MobileSignoutCard } from '@/features/settings/components/MobileSignoutCard'

/**
 * PRP-034 Sub-fase 1: /settings consolidado.
 *
 * Server Component que hidrata Profile con email + role desde Supabase SSR.
 * El layout `(app)/layout.tsx` ya hace auth gate, por lo que aquí podemos
 * asumir `user != null` — pero defensa-en-profundidad consume `getUser()`
 * idempotente por costo cero.
 */
export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''
  const role = email ? getRoleForEmail(email) : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
      <ProfileCard email={email} role={role} />
      <AppearanceCard />
      <NotificationsCard />
      <IntegrationsCard />
      <MobileSignoutCard />
    </div>
  )
}
