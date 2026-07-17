# Visual regression — best practices

Snapshots comparativos detectan cambios visuales no intencionales (CSS regresiono, font cambio, layout se rompio en mobile). Pero mal usados generan false positives constantes.

## Setup basico

```ts
test('dashboard layout estable', async ({ page }) => {
  await page.goto('/(app)/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

Primer run crea baseline en `dashboard.spec.ts-snapshots/dashboard-chromium-darwin.png`. Runs siguientes comparan.

## Threshold de tolerancia

Antialiasing y subpixel rendering generan diffs minimos no significativos. Usar threshold:

```ts
await expect(page).toHaveScreenshot('dashboard.png', {
  threshold: 0.05, // 5% de pixels diferentes tolerados
  maxDiffPixels: 100, // o numero absoluto de pixels
});
```

5% es tipico para matchear "lo mismo a ojo humano". Para tests muy estrictos (logo perfecto), bajar a 0.01.

## Ignorar regiones dinamicas

Timestamps, contadores, animaciones loop generan diff en cada run. Mascararlos:

```ts
await expect(page).toHaveScreenshot('dashboard.png', {
  mask: [
    page.locator('.timestamp'),
    page.locator('[data-dynamic]'),
    page.locator('.notification-count'),
  ],
});
```

Las regiones masked se renderizan como rectangulos solidos en la comparacion.

## Disable animaciones

```ts
await page.addStyleTag({
  content: `
    *, *::before, *::after {
      animation-duration: 0s !important;
      transition-duration: 0s !important;
    }
  `,
});
await expect(page).toHaveScreenshot('dashboard.png');
```

Sin esto, un screenshot tomado mid-fadeIn tiene opacity diferente cada run.

## Multiple viewports

```ts
test('dashboard responsive', async ({ page }) => {
  for (const viewport of [
    { width: 375, height: 667, name: 'mobile' },
    { width: 768, height: 1024, name: 'tablet' },
    { width: 1920, height: 1080, name: 'desktop' },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/(app)/dashboard');
    await expect(page).toHaveScreenshot(`dashboard-${viewport.name}.png`);
  }
});
```

## Cuando regenerar baseline

```bash
npx playwright test --update-snapshots
```

Cuando intencionalmente cambiaste el layout. Commitear los nuevos `*.png` al PR.

NUNCA regenerar baselines automaticamente en CI — eso defeats el proposito.

## False positives comunes

1. **Font rendering distinto entre OS**: Mac vs Linux renderizan fonts levemente diferente. Solucion: correr tests visuales solo en una OS (Linux CI con `playwright/test:focal`).
2. **Browser version cambio**: subir Chromium puede cambiar antialiasing. Pin version en `package.json`.
3. **Async data carga distinta**: si el contenido depende de data que llega a tiempos variables, esperar explicito antes de screenshot.

## Cross-ref con image-kit

Para reportes con thumbnails comparativos before/after lado a lado:

```ts
import { generateAndPublish } from '@/lib/image/pipeline';

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status === 'failed' && testInfo.attachments.length > 0) {
    const baseline = testInfo.attachments.find((a) => a.name === 'expected');
    const actual = testInfo.attachments.find((a) => a.name === 'actual');

    if (baseline && actual) {
      // Componer side-by-side via sharp
      const composite = await sharp(baseline.body)
        .extend({ right: 1200 })
        .composite([{ input: actual.body, left: 1200, top: 0 }])
        .toBuffer();

      // Subir a storage para incluir en reporte
      await generateAndPublish({ /* ... */ });
    }
  }
});
```

Cross-ref `@.claude/skills/image-kit/SKILL.md`.
