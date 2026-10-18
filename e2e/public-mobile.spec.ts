import { expect, test } from '@playwright/test';

test.describe('public mobile journey', () => {
  test('shows a usable landing page and routes to sign in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /train smarter/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /start free/i })).toBeVisible();
    await page.getByRole('link', { name: /start free/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('renders the not-found recovery page', async ({ page }) => {
    await page.goto('/missing-page');
    await expect(page.getByRole('heading')).toContainText(/does not exist/i);
  });
});
