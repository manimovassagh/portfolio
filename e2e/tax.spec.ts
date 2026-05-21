import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './fixtures';

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
});

test('tax page shows FSA tracker', async ({ page }) => {
  await page.goto('/tax');
  // FSA tracker section header
  await expect(page.getByText(/FSA tracker/i)).toBeVisible({ timeout: 10000 });
  // "987.66 remaining" or "€987.66 buffer" — use first() since both match /987/
  await expect(page.getByText(/987/).first()).toBeVisible({ timeout: 5000 });
});
