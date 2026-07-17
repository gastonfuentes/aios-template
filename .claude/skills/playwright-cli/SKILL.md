---
name: playwright-cli
description: "Testea apps Next.js con Playwright sin abrir UI: navega, llena formularios, hace clicks, toma screenshots, genera reportes HTML auto-servidos. Casos de uso YOUR_COMMUNITY-flavored: verifica que tu landing convierta, checkear que el checkout de Polar funciona, regression visual con thumbnails comparativos. Activar cuando el usuario menciona testear esto, revisar que funcione, hay un bug, validar el flujo, e2e, automatizar UI tests, regresion visual, o pide 'verificame que el signup ande'."
allowed-tools: Read, Write, Edit, Bash
---

# playwright-cli — testing automatizado con reporte navegable

> Diferencia genuina vs cualquier otra setup Playwright: reporte HTML auto-servido al cerrar (`python3 -m http.server`), thumbnails comparativos en cada step (cross-ref `image-kit`), y casos de uso pre-definidos para los flows criticos del alumno YOUR_COMMUNITY (signup, checkout, dashboard).

---

## Cuando activar

- "Testea que el signup ande."
- "Verifica que mi landing convierta."
- "Hay un bug en el checkout, revisalo."
- "Necesito regresion visual de mi dashboard."
- "Automatiza el flujo end-to-end."

## Cuando NO activar

- Tests unitarios de funciones puras. Eso es Vitest, no Playwright.
- Carga / stress testing. Es k6 / Artillery, fuera de scope.
- Solo verificar API endpoints sin UI. `curl` o `httpie`.

## Antes de empezar — verifica empiricamente

- [ ] App corriendo en `http://localhost:3000` (dev server). Si no, `npm run dev` en otro terminal.
- [ ] `npm install -D @playwright/test` instalado. Si no, `npx playwright install`.
- [ ] Browsers instalados: `npx playwright install chromium webkit firefox`.
- [ ] Si usas `auth-stack`: usuario de prueba creado en BD (`scripts/seed-test-users.sh` de auth-stack).

## Flujo principal — primer test E2E

### Paso 1: setup playwright config

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
});
```

Razon de `chromium` + `mobile`: cubre el 80% de combinaciones reales de tus usuarios. Firefox/Safari desktop solo si tienes evidencia de que segmento significativo lo usa.

### Paso 2: test signup flow

`tests/e2e/signup.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('signup con magic-link funciona', async ({ page }) => {
  await page.goto('/signin');

  await expect(page.getByRole('heading', { name: /Bienvenido/i })).toBeVisible();

  await page.fill('input[type="email"]', `test-${Date.now()}@example.com`);
  await page.click('button[type="submit"]');

  // Confirmacion visible
  await expect(page.getByText(/Revisa tu correo/i)).toBeVisible();

  // Captura para reporte
  await page.screenshot({ path: 'tests/e2e/snapshots/signup-success.png' });
});
```

Razon de timestamp en email: cada test corre con email unico, no choca con tests previos sin requerir cleanup.

### Paso 3: test checkout flow

```ts
test('checkout de Polar funciona', async ({ page }) => {
  // Login con test user
  await page.goto('/signin');
  await page.fill('input[type="email"]', 'test@example.com');
  // En testing skipear magic-link via test endpoint (cross-ref auth-stack/scripts/seed-test-users.sh)
  await page.context().addCookies([{
    name: 'sb-access-token',
    value: process.env.TEST_USER_TOKEN!,
    domain: 'localhost',
    path: '/',
  }]);

  await page.goto('/(app)/upgrade');

  // Click upgrade triggers Polar checkout redirect
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('button:has-text("Comprar")'),
  ]);

  // Verificar que llego a sandbox de Polar
  await expect(popup).toHaveURL(/sandbox\.polar\.sh/);
});
```

### Paso 4: regresion visual con thumbnails comparativos

```ts
test('dashboard layout no cambio', async ({ page }) => {
  await page.goto('/(app)/dashboard');
  await expect(page).toHaveScreenshot('dashboard-layout.png', {
    threshold: 0.05, // 5% de diferencia tolerada (leves cambios de antialiasing)
  });
});
```

Primer run crea baseline en `tests/e2e/dashboard.spec.ts-snapshots/dashboard-layout.png`. Runs siguientes comparan contra baseline. Si el layout cambio sustancialmente, el test falla y muestra diff visual.

### Paso 5: ejecutar + reporte

```bash
npx playwright test
# Cuando termina, levantar reporte:
cd playwright-report && python3 -m http.server 8080
# Abrir http://localhost:8080 en browser
```

El reporte muestra: cada test pasado/fallado, screenshots, video del fail (si retain-on-failure), trace navegable timeline.

## Si tu Directiva no es Next.js

- Cualquier app web: Playwright es framework-agnostico. Cambia `baseURL` y va.
- React Native: Playwright no aplica. Usar Detox (E2E nativo) o Maestro (testing simple cross-platform).
- Backend-only: no aplica — no hay UI. Usar `supertest` para HTTP endpoints.

## Cross-references con skills hermanas

- `@.claude/skills/auth-stack/SKILL.md` — flow de signup/signin para testear. Hand-off: `seed-test-users.sh` crea usuarios; tests los reusan via cookie injection.
- `@.claude/skills/payments-polar/SKILL.md` — sandbox de Polar para testear checkout sin cobrar real. Hand-off: env var `POLAR_SANDBOX_PRODUCT_ID` apunta al producto de pruebas.
- `@.claude/skills/image-kit/SKILL.md` — generar thumbnails comparativos cuando un test fall y quieras side-by-side antes/despues. Hand-off: el reporter custom llama el pipeline para componer.
- `@.claude/skills/frontend-design/SKILL.md` — los selectores de tests (`getByRole`, `getByText`) se basan en accessibility correcta. Si frontend-design no implemento labels y roles, tests son fragiles.

## Archivos lazy-loaded

- `references/selectors.md` — guia de selectores: `getByRole > getByLabel > getByText > CSS selector` por preferencia.
- `references/auth-bypass.md` — patrones para skipear magic-link en tests (cookie injection, test-only API endpoints).
- `references/visual-regression.md` — best practices para snapshots (ignorar regiones dinamicas, threshold por viewport, baseline management).
- `references/ci-integration.md` — correr tests en GitHub Actions / Vercel preview deployments.
- `assets/playwright.config.ts` — config completo copy-paste.
- `assets/example-tests/` — tests pre-armados para signup, checkout, dashboard.
- `scripts/run-with-report.sh` — corre tests + auto-sirve reporte HTML al terminar.

## Validacion al cerrar

- [ ] `npx playwright test` retorna 0 (todos los tests pasan).
- [ ] Reporte HTML accesible en `localhost:8080` con timeline navegable.
- [ ] Si hay falla: screenshot + video disponibles en el reporte.
- [ ] Snapshots de regresion visual estables (no hay false positives por antialiasing).
- [ ] CI pipeline verde (si configurado).
