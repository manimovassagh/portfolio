import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
});

test('markets page loads with search input', async ({ page }) => {
  await page.goto('/markets');
  const input = page.getByPlaceholder(/Search ticker or company/i);
  await expect(input).toBeVisible({ timeout: 10000 });
});

test('markets search returns results', async ({ page }) => {
  await page.goto('/markets');
  const input = page.getByPlaceholder(/Search ticker or company/i);
  await input.fill('AAPL');
  // The search mock returns Apple Inc. as a result.
  await expect(page.getByText('Apple Inc.').first()).toBeVisible({ timeout: 10000 });
});
