'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/core/adapters/supabase/server'
import { isEmailAllowed } from '@/core/config/auth'

const emailSchema = z.string().trim().toLowerCase().email()

export async function requestMagicLink(formData: FormData): Promise<{ error?: string }> {
  const raw = formData.get('email')
  const parsed = emailSchema.safeParse(raw)

  if (!parsed.success) {
    return { error: 'Pon un email valido.' }
  }

  const email = parsed.data

  if (!isEmailAllowed(email)) {
    return { error: 'Este email no tiene acceso a Gannet OS.' }
  }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      shouldCreateUser: true,
    },
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/check-email')
}

export async function signout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
