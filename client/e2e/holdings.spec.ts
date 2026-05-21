import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
});

test('holdings page shows positions', async ({ page }) => {
  await page.goto('/holdings');
  // Target the desktop table view (not the hidden mobile card).
  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 10000 });
  await expect(table.getByText(/iShares Core MSCI World/i)).toBeVisible({ timeout: 5000 });
  await expect(table.getByText('IE00B4L5Y983')).toBeVisible({ timeout: 5000 });
});
