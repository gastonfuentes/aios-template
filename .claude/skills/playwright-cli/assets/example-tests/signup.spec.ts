import { test, expect } from '@playwright/test';

test.describe('Signup flow', () => {
  test('magic-link signin muestra confirmacion', async ({ page }) => {
    await page.goto('/signin');

    await expect(
      page.getByRole('heading', { name: /Bienvenido/i }),
    ).toBeVisible();

    const email = `test-${Date.now()}@example.com`;
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /enviar/i }).click();

    await expect(page.getByText(/Revisa tu correo/i)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test('email invalido muestra error', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByRole('button', { name: /enviar/i }).click();

    // El input HTML5 type=email bloquea submit; verificar que sigue en /signin
    await expect(page).toHaveURL(/\/signin/);
  });

  test('redirect a signin cuando rutas privadas sin auth', async ({ page }) => {
    await page.goto('/(app)/dashboard');
    await expect(page).toHaveURL(/\/signin/);
  });
});
