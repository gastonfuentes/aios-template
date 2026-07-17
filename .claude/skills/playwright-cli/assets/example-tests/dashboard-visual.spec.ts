import { test, expect } from '@playwright/test';

test.describe('Dashboard visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Disable animaciones para snapshots estables
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      `,
    });
  });

  test('dashboard layout estable en desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/(app)/dashboard');

    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      mask: [
        page.locator('[data-dynamic]'), // timestamps, contadores en vivo
        page.locator('.notification-count'),
      ],
      threshold: 0.05,
    });
  });

  test('dashboard layout en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/(app)/dashboard');

    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      mask: [page.locator('[data-dynamic]')],
      threshold: 0.05,
    });
  });

  test('signin form visual', async ({ page }) => {
    await page.goto('/signin');
    await expect(page).toHaveScreenshot('signin.png', { threshold: 0.05 });
  });
});
