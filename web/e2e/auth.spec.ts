import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Phase 10.C — production auth: email + password + email-verification.
 * The magic-link path is removed from the UI (the API still accepts
 * method:'magic-link' for the support runbook). These tests tolerate
 * mock-mode (dev without Supabase env vars) and unconfigured-mode
 * (prod without env vars) so they pass against any deployment.
 */

const LOCALES = [
  { code: 'en', dir: 'ltr' },
  { code: 'ar', dir: 'rtl' },
] as const;

test.describe('auth surfaces — render + a11y', () => {
  for (const { code, dir } of LOCALES) {
    for (const route of ['/signup', '/login', '/reset-password'] as const) {
      test(`/${code}${route} renders in ${dir} with no axe blockers`, async ({ page }) => {
        await page.goto(`/${code}${route}`);
        await expect(page.locator('html')).toHaveAttribute('lang', code);
        await expect(page.locator('html')).toHaveAttribute('dir', dir);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        const a11y = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
          .analyze();
        const blocking = a11y.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toHaveLength(0);
      });
    }
  }
});

test.describe('signup form — production password flow', () => {
  test('school role reveals the school-name field', async ({ page }) => {
    await page.goto('/en/signup');
    await expect(page.getByLabel(/school name/i)).toHaveCount(0);
    await page
      .getByText(/school staff/i, { exact: false })
      .first()
      .click();
    await expect(page.getByLabel(/school name/i)).toBeVisible();
  });

  test('password strength meter updates with input', async ({ page }) => {
    await page.goto('/en/signup');
    const pw = page.getByLabel(/^password$/i);
    await expect(pw).toBeVisible();
    await pw.fill('weak');
    await expect(page.getByText(/weak/i)).toBeVisible();
    await pw.fill('strong-passw0rd-2026');
    await expect(page.getByText(/strong|excellent/i)).toBeVisible();
  });

  test('confirm password must match', async ({ page }) => {
    await page.goto('/en/signup');
    await page
      .getByText(/parent or family/i)
      .first()
      .click();
    await page.getByLabel(/full name/i).fill('Test Parent');
    await page.getByLabel(/^email$/i).fill('confirm-mismatch@example.com');
    await page.getByLabel(/^password$/i).fill('strong-passw0rd-2026');
    await page.getByLabel(/confirm password/i).fill('different-passw0rd');
    await page
      .getByText(/i agree to the/i)
      .first()
      .click();
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/passwords don't match/i)).toBeVisible();
  });

  test('completing the signup form reaches the check-email state (mock or real)', async ({
    page,
  }) => {
    await page.goto('/en/signup');

    await page
      .getByText(/parent or family/i)
      .first()
      .click();
    await page.getByLabel(/full name/i).fill('Test Parent');
    await page.getByLabel(/^email$/i).fill('test-parent@example.com');
    await page.getByLabel(/^password$/i).fill('strong-passw0rd-2026');
    await page.getByLabel(/confirm password/i).fill('strong-passw0rd-2026');
    await page
      .getByText(/i agree to the/i)
      .first()
      .click();

    await page.getByRole('button', { name: /create account/i }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /check your email|getting set up|temporarily unavailable/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('signup form blocks submit when consent unchecked', async ({ page }) => {
    await page.goto('/en/signup');
    await page
      .getByText(/parent or family/i)
      .first()
      .click();
    await page.getByLabel(/full name/i).fill('No Consent');
    await page.getByLabel(/^email$/i).fill('no-consent@example.com');
    await page.getByLabel(/^password$/i).fill('strong-passw0rd-2026');
    await page.getByLabel(/confirm password/i).fill('strong-passw0rd-2026');
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/we need your agreement/i)).toBeVisible();
  });

  test('signup UI no longer exposes the magic-link option', async ({ page }) => {
    await page.goto('/en/signup');
    await expect(page.getByRole('button', { name: /send me a magic link/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /use a password instead/i })).toHaveCount(0);
  });
});

test.describe('login form — production password flow', () => {
  test('login form has email + password + forgot link, no magic-link UI', async ({ page }) => {
    await page.goto('/en/login');
    await expect(page.getByLabel(/^email$/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/en/reset-password',
    );
    await expect(page.getByRole('button', { name: /send me a magic link/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /sign in with password/i })).toHaveCount(0);
  });

  test('invalid credentials surface a clear error', async ({ page }) => {
    await page.goto('/en/login');
    await page.getByLabel(/^email$/i).fill('does-not-exist@example.com');
    await page.getByLabel(/^password$/i).fill('whatever-passw0rd-99');
    await page.getByRole('button', { name: /sign in$/i }).click();
    await expect(
      page.getByRole('alert').filter({
        hasText: /don't match|couldn't find|verify your email|temporarily unavailable|going wrong/i,
      }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('reset-password — request flow', () => {
  test('renders in EN + AR with back-to-login link', async ({ page }) => {
    for (const { code } of LOCALES) {
      await page.goto(`/${code}/reset-password`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(
        page.getByRole('link', { name: /back to sign in|العودة إلى تسجيل الدخول/ }),
      ).toHaveAttribute('href', `/${code}/login`);
    }
  });

  test('submitting an email reaches the sent state (mock or real)', async ({ page }) => {
    await page.goto('/en/reset-password');
    await page.getByLabel(/^email$/i).fill('reset-me@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();
    await expect(page.getByTestId('reset-password-sent')).toBeVisible({ timeout: 10_000 });
  });
});
