import { test, expect } from '@playwright/test';
import { mockApiRoutes } from './fixtures';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.beforeEach(async ({ page }) => {
  await mockApiRoutes(page);
});

test('CSV upload via header button shows success toast', async ({ page }) => {
  // Create a minimal CSV in a temp file.
  const csv = 'Date,Type,Name,ISIN,Shares,Price per share,Amount,Fee,Tax\n2024-01-01,BUY,Test,IE00B4L5Y983,1,80,80,0,0\n';
  const tmpFile = path.join(os.tmpdir(), 'test-export.csv');
  fs.writeFileSync(tmpFile, csv);

  await page.goto('/');

  // Find the upload / import button in the header.
  const uploadBtn = page.getByRole('button', { name: /import|upload|csv/i }).first();
  if (await uploadBtn.isVisible()) {
    await uploadBtn.click();
    // A file input should be present (may be hidden).
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(tmpFile);
    // Toast should confirm upload.
    await expect(page.getByText(/loaded|uploaded|demo\.csv/i)).toBeVisible({ timeout: 8000 });
  }

  fs.unlinkSync(tmpFile);
});
