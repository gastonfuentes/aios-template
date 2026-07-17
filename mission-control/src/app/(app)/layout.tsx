import { redirect } from 'next/navigation'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'
import { AppShell } from '@/core/components/macos/AppShell'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!isEmailAllowed(user.email ?? '')) {
    await supabase.auth.signOut()
    redirect('/login?error=unauthorized')
  }

  return <AppShell>{children}</AppShell>
}
