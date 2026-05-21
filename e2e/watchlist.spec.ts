import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
  // Override POST /api/watchlist to return a new item; GET falls through to fixtures.
  await page.route('**/api/watchlist', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: {
          items: [
            { isin: 'IE00B4L5Y983', ticker: 'IWDA', name: 'iShares Core MSCI World', notes: '', target_price: 100.0, added_date: '2025-01-01', current_price: 90.0 },
          ],
        },
      });
    } else {
      await route.fallback();
    }
  });
});

test('watchlist shows existing items', async ({ page }) => {
  await page.goto('/watchlist');
  // The desktop table view shows Apple Inc. from our fixture.
  const table = page.locator('table');
  await expect(table).toBeVisible({ timeout: 10000 });
  await expect(table.getByText('Apple Inc.')).toBeVisible({ timeout: 5000 });
});

test('watchlist add form opens', async ({ page }) => {
  await page.goto('/watchlist');
  await page.getByRole('button', { name: /add item/i }).click();
  await expect(page.getByPlaceholder('IE00B4L5Y983')).toBeVisible({ timeout: 5000 });
});

test('watchlist add flow with valid ISIN', async ({ page }) => {
  await page.goto('/watchlist');
  await page.getByRole('button', { name: /add item/i }).click();
  await page.getByPlaceholder('IE00B4L5Y983').fill('IE00B4L5Y983');
  await page.getByPlaceholder(/iShares Core MSCI World/i).fill('iShares Core MSCI World');
  await page.getByRole('button', { name: /^add$/i }).click();
  // After POST, the new item appears in the table.
  await expect(page.locator('table').getByText(/iShares Core MSCI World/i)).toBeVisible({ timeout: 5000 });
});
