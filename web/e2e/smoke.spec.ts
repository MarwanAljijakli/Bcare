import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

// Module 0 smoke: app renders, locales work, no serious axe violations.
// The full critical-flows suite is built incrementally per module.

test.describe('smoke: bilingual landing renders without a11y blockers', () => {
  test('English landing renders, no serious/critical axe violations', async ({ page }) => {
    await page.goto('/en');
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    const blocking = a11y.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toHaveLength(0);
  });

  test('Arabic landing renders RTL, no serious/critical axe violations', async ({ page }) => {
    await page.goto('/ar');
    await expect(page).toHaveURL(/\/ar$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    const blocking = a11y.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toHaveLength(0);
  });

  test('language toggle navigates between /en and /ar preserving the path', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('button', { name: /العربية/ }).click();
    await expect(page).toHaveURL(/\/ar$/);

    await page.getByRole('button', { name: /English/ }).click();
    await expect(page).toHaveURL(/\/en$/);
  });
});
