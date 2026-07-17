# Adaptacion: Remix

`@supabase/ssr` ya soporta Remix oficialmente. El patron clave:

- `app/lib/supabase.server.ts` — server client (loaders + actions).
- `app/lib/supabase.browser.ts` — browser client (componentes "client-only").
- `app/root.tsx` carga la sesion en el loader y la pasa por context.

Proteccion de rutas: chequear sesion en cada `loader` de las rutas privadas. No hay middleware nativo Remix — el patron es:

```ts
// app/routes/_app.dashboard.tsx
import { redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { createServerClient } from '~/lib/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabase, headers } = createServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw redirect('/signin', { headers });
  return json({ user }, { headers });
}
```

Migracion `profiles` + RLS: identica.

Si dudas entre Remix y Next.js para un alumno principiante: Next.js es el default Praxis. Remix es para casos donde el alumno ya tiene preferencia explicita.
