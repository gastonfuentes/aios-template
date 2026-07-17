import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/core/adapters/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Behind a reverse proxy (Traefik + Cloudflare Tunnel) request.nextUrl.origin
  // resolves to the container's internal address (http://localhost:3000), which
  // would send auth redirects to a dead host. Redirect against the public URL.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? origin

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?error=link_expired`)
  }

  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  return NextResponse.redirect(`${baseUrl}${safeNext}`)
}
