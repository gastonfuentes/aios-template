import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isEmailAllowed } from '@/core/config/auth'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // API routes: bearer/session is checked inside each route handler.
  if (pathname.startsWith('/api/')) return supabaseResponse

  // /auth/callback handles the magic-link exchange — must be public.
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/check-email')
  const isPublicRoute = isAuthRoute || pathname.startsWith('/auth/callback')

  if (!isPublicRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    if (pathname && pathname !== '/') {
      loginUrl.searchParams.set('next', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (user && !isEmailAllowed(user.email ?? '')) {
    await supabase.auth.signOut()
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'unauthorized')
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}
