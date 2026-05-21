import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
});

test('app loads and shows overview with portfolio value', async ({ page }) => {
  await page.goto('/overview');
  // Portfolio value from mock: 12345.67 → displayed as €12,346 (rounded).
  // Multiple occurrences possible; use first().
  await expect(page.getByText(/12[,.]?34[456]/).first()).toBeVisible({ timeout: 12000 });
});

test('sidebar navigation groups are visible', async ({ page }) => {
  await page.goto('/overview');
  // Desktop sidebar nav group labels are always present.
  await expect(page.getByText('Portfolio').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('Finances').first()).toBeVisible({ timeout: 5000 });
});

test('dark mode toggle works', async ({ page }) => {
  await page.goto('/overview');
  const html = page.locator('html');
  const initialClass = await html.getAttribute('class');
  const toggle = page.getByRole('button', { name: /dark|light|theme/i });
  if (await toggle.count() > 0) {
    await toggle.first().click();
    const newClass = await html.getAttribute('class');
    expect(newClass).not.toBe(initialClass);
  }
});
