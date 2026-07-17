# Adaptacion: SvelteKit

Estructura equivalente a Next.js App Router:

- `src/lib/supabase.ts` exporta `createBrowserClient` y `createServerClient` con `@supabase/ssr`.
- `src/hooks.server.ts` reemplaza al middleware Next.js — intercepta cada request, lee cookies, redirige a `/signin` si la ruta empieza con `/(app)`.
- `src/routes/(public)/+layout.svelte` y `src/routes/(app)/+layout.svelte` definen los grupos publicos/privados.

Migracion de tabla `profiles` con RLS: identica.

```ts
// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr';
import { redirect, type Handle } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookies) => cookies.forEach((c) => event.cookies.set(c.name, c.value, c.options)),
    },
  });

  const { data: { user } } = await event.locals.supabase.auth.getUser();

  if (!user && event.url.pathname.startsWith('/(app)')) {
    redirect(303, '/signin');
  }

  return resolve(event);
};
```

Cross-ref a Paso 4 (multi-rol) y Paso 5 (membership-guard) — los helpers se adaptan trivial: en lugar de `redirect()` de `next/navigation`, usar `redirect()` de `@sveltejs/kit`.
