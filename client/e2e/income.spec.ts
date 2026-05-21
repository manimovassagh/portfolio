import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
});

test('income page loads with total', async ({ page }) => {
  await page.goto('/income');
  // Income section heading should be visible.
  await expect(page.getByRole('heading', { name: /^Income$/i })).toBeVisible({ timeout: 10000 });
  // Desktop table headers indicate data loaded — "Amount" column only in the table view.
  await expect(page.getByRole('columnheader', { name: /Amount/i })).toBeVisible({ timeout: 5000 });
});
