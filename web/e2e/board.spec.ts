import { test, expect } from '@playwright/test';

/**
 * /board E2E — covers the unauthenticated bounce + the live attribution
 * footer. Authenticated tap-and-speak flow lives behind the auth fixture
 * which is wired in Module 9 hardening (RLS test Supabase project + seeded
 * caregiver). The shape below is what those richer specs grow into.
 *
 * For Module 3 we assert:
 *  - /en/board redirects to /en/login when there's no session.
 *  - /ar/board redirects to /ar/login when there's no session.
 *  - The accessibility statement carries the ARASAAC attribution.
 */

test.describe('board route — bilingual gate + attribution', () => {
  test('unauthenticated /en/board bounces to /en/login', async ({ page }) => {
    const res = await page.goto('/en/board');
    // The middleware + (app) layout combine into a server-side redirect.
    // Final URL must be /en/login.
    await expect(page).toHaveURL(/\/en\/login(\?|$)/);
    expect(res?.ok()).toBeTruthy();
  });

  test('unauthenticated /ar/board bounces to /ar/login', async ({ page }) => {
    await page.goto('/ar/board');
    await expect(page).toHaveURL(/\/ar\/login(\?|$)/);
    // Page is rendered RTL after the bounce.
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'rtl');
  });

  test('/en/accessibility carries the ARASAAC attribution', async ({ page }) => {
    await page.goto('/en/accessibility');
    await expect(page.getByText(/ARASAAC/i)).toBeVisible();
    await expect(page.getByText(/CC BY-NC-SA/i)).toBeVisible();
  });

  test('/ar/accessibility carries the ARASAAC attribution', async ({ page }) => {
    await page.goto('/ar/accessibility');
    await expect(page.getByText(/ARASAAC/i)).toBeVisible();
  });
});
