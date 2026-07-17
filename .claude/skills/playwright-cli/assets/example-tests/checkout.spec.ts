import { test, expect } from '@playwright/test';

test.describe('Checkout de Polar', () => {
  test.beforeEach(async ({ page, context }) => {
    // Auth bypass via cookie injection (cross-ref references/auth-bypass.md)
    if (!process.env.TEST_USER_TOKEN) {
      test.skip();
      return;
    }

    await context.addCookies([
      {
        name: 'sb-access-token',
        value: process.env.TEST_USER_TOKEN,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      },
    ]);
  });

  test('boton de upgrade redirige a sandbox de Polar', async ({ page }) => {
    await page.goto('/(app)/upgrade');

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: /comprar|upgrade/i }).click(),
    ]);

    await popup.waitForLoadState();
    await expect(popup).toHaveURL(/sandbox\.polar\.sh|polar\.sh/);
  });

  test('webhook simula cobro y muestra dashboard actualizado', async ({ page, request }) => {
    // Simular el webhook que Polar enviaria tras checkout exitoso
    // Cross-ref: payments-polar skill scripts/test-webhook.sh
    await request.post('/api/test/simulate-purchase', {
      data: { user_email: 'test@example.com', product_id: 'prod_test' },
    });

    await page.goto('/(app)/dashboard');
    await expect(page.getByText(/acceso activo|membresia activa/i)).toBeVisible();
  });
});
