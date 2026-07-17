# Clients browser / server / middleware

> Patron canonico de creacion de Supabase clients en Next.js App Router con SSR + cookies. Reusa el scaffold base de Praxis (`src/lib/supabase/`) para evitar duplicacion.

---

## Browser client (componentes "use client")

```ts
// src/lib/supabase/browser.ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

Razon: el browser client lee cookies del navegador y se sincroniza con la sesion server-side. No usa service-role.

## Server client (Server Components + Route Handlers)

```ts
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components no pueden setear cookies — el middleware lo hace.
          }
        },
      },
    },
  );
}
```

## Middleware client

```ts
// src/lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirige a /signin si la ruta es protegida.
  if (!user && request.nextUrl.pathname.startsWith('/(app)')) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

## Por que tres clients distintos

- Browser client → corre en el navegador, lee cookies via `document.cookie`.
- Server client → corre en server components, lee cookies via `next/headers`.
- Middleware client → corre en edge runtime, lee/escribe cookies del request directamente.

Mezclar los tres causa "Auth session missing" o "cookies cant be set in Server Components". Usar el client correcto en cada contexto.
