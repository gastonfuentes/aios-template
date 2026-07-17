# Auth bypass — testear flows que requieren login

Magic-link no funciona en tests E2E (no hay forma de leer el email automaticamente sin abrir mailbox externo). Tres patrones para skipear:

## Patron 1: Cookie injection (recomendado)

Pre-genera un access token via Supabase admin API y mete la cookie directo:

```ts
// tests/e2e/setup/auth.ts
import { createClient } from '@supabase/supabase-js';

export async function getTestUserToken(email: string): Promise<string> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Generar magic-link y extraer el token sin enviarlo
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error || !data.properties?.action_link) throw new Error('cant generate link');

  const url = new URL(data.properties.action_link);
  return url.searchParams.get('token')!;
}
```

En el test:

```ts
import { test } from '@playwright/test';
import { getTestUserToken } from './setup/auth';

test.beforeEach(async ({ page }) => {
  const token = await getTestUserToken('test@example.com');
  // Visitar el callback URL para canjear token por sesion
  await page.goto(`/auth/callback?token=${token}&type=magiclink&email=test@example.com`);
});

test('dashboard requiere login', async ({ page }) => {
  await page.goto('/(app)/dashboard');
  // Ya logged in, deberia mostrar contenido
});
```

## Patron 2: Test-only API endpoint

Crear `/api/test/login` que solo existe en `NODE_ENV=test`:

```ts
// src/app/api/test/login/route.ts
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'test') {
    return new Response('not allowed', { status: 403 });
  }

  const { email } = await request.json();
  // ... generar sesion via service-role + setCookie
  return Response.json({ ok: true });
}
```

En el test:

```ts
test.beforeEach(async ({ request, page }) => {
  await request.post('/api/test/login', { data: { email: 'test@example.com' } });
  await page.goto('/(app)/dashboard');
});
```

Razon: simpler que cookie injection, pero requiere endpoint adicional y la guarda `NODE_ENV=test` debe ser robusta.

## Patron 3: storageState (mas rapido en runs grandes)

Pre-login una vez, exporta el state, los demas tests reusan:

```ts
// tests/e2e/global-setup.ts
import { chromium, type FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Login flow real (una sola vez)
  await page.goto('http://localhost:3000/signin');
  // ... usar uno de los patrones anteriores

  // Guardar state
  await page.context().storageState({ path: 'tests/e2e/.auth/state.json' });
  await browser.close();
}
```

`playwright.config.ts`:

```ts
export default defineConfig({
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  use: {
    storageState: 'tests/e2e/.auth/state.json',
  },
});
```

Cada test arranca ya logueado. Ideal para suites grandes (decenas de tests).

## Limpiar test users

```sql
-- Eliminar usuarios de test al final de la suite
delete from public.profiles
where email like '%@example.com' or email like 'test-%@%';
```

Correr como teardown en `globalTeardown` o cron job semanal.

## Anti-patron

❌ Hardcodear passwords en tests checkeados a git. Usar `.env.test` ignorado.
❌ Reusar el mismo email entre tests sin cleanup. Genera state inconsistente.
❌ Bypass que funcione en prod ("flag oculto que solo conoce el tester"). Si llega a prod, es vulnerabilidad.

## Cross-ref

`@.claude/skills/auth-stack/scripts/seed-test-users.sh` crea los users iniciales. Esta skill solo los usa.
