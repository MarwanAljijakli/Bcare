import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Module 2.A — Auth UI tests. Tolerant of mock-mode (dev w/o env vars) and
 * unconfigured-mode (prod w/o env vars): magic-link/password submit assertions
 * check for the appropriate state without requiring a live Supabase project.
 *
 * The tests run against the production build via the Playwright webServer
 * config (`pnpm exec next start`). When SUPABASE env vars are set on that
 * server, the API routes flip to real mode automatically.
 */

const LOCALES = [
  { code: 'en', dir: 'ltr', getStarted: /get started/i, signIn: /sign in/i },
  { code: 'ar', dir: 'rtl', getStarted: /ابدأ الآن/, signIn: /تسجيل الدخول/ },
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

test.describe('signup form — flow', () => {
  test('school role reveals the school-name field', async ({ page }) => {
    await page.goto('/en/signup');

    // School field should not be visible until the school role is selected.
    await expect(page.getByLabel(/school name/i)).toHaveCount(0);

    // Click the "School staff" radio card. The label contains the role
    // description — we click the visible label, not the sr-only input.
    await page
      .getByText(/school staff/i, { exact: false })
      .first()
      .click();

    await expect(page.getByLabel(/school name/i)).toBeVisible();
  });

  test('password disclosure reveals password input + strength meter', async ({ page }) => {
    await page.goto('/en/signup');
    await page.getByRole('button', { name: /use a password instead/i }).click();
    const pw = page.getByLabel(/^password$/i);
    await expect(pw).toBeVisible();
    await pw.fill('weak');
    await expect(page.getByText(/weak/i)).toBeVisible();
    await pw.fill('strong-passw0rd-2026');
    await expect(page.getByText(/strong|excellent/i)).toBeVisible();
  });

  test('signup magic-link path reaches the check-email success state (mock or real)', async ({
    page,
  }) => {
    await page.goto('/en/signup');

    await page
      .getByText(/parent or family/i)
      .first()
      .click();
    await page.getByLabel(/full name/i).fill('Test Parent');
    await page.getByLabel(/email/i).fill('test-parent@example.com');
    await page
      .getByText(/i agree to the/i)
      .first()
      .click();

    await page.getByRole('button', { name: /send me a magic link/i }).click();
    // Either a success view (mock or real) or an unconfigured-mode error;
    // both are acceptable since this test runs across deployments.
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: /check your email|getting set up|temporarily unavailable/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('signup with "exists" trigger shows user-already-registered error (mock only)', async ({
    page,
  }) => {
    test.skip(
      !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      'mock-only trigger; live Supabase will reject differently',
    );
    await page.goto('/en/signup');
    await page
      .getByText(/parent or family/i)
      .first()
      .click();
    await page.getByLabel(/full name/i).fill('Already Exists');
    await page.getByLabel(/email/i).fill('user-exists@example.com');
    await page
      .getByText(/i agree to the/i)
      .first()
      .click();
    await page.getByRole('button', { name: /send me a magic link/i }).click();

    await expect(page.getByRole('alert').filter({ hasText: /already registered/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('signup form blocks submit when consent unchecked', async ({ page }) => {
    await page.goto('/en/signup');
    await page
      .getByText(/parent or family/i)
      .first()
      .click();
    await page.getByLabel(/full name/i).fill('No Consent');
    await page.getByLabel(/email/i).fill('no-consent@example.com');
    // Don't tick consent.
    await page.getByRole('button', { name: /send me a magic link/i }).click();
    await expect(page.getByText(/we need your agreement/i)).toBeVisible();
  });
});

test.describe('login form — flow', () => {
  test('magic-link path reaches success state', async ({ page }) => {
    await page.goto('/en/login');
    await page.getByLabel(/email/i).fill('returning@example.com');
    await page.getByRole('button', { name: /send me a magic link/i }).click();
    await expect(
      page
        .getByRole('status')
        .filter({
          hasText: /check your email|getting set up|temporarily unavailable|couldn't find|invalid/i,
        }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('password disclosure reveals password input', async ({ page }) => {
    await page.goto('/en/login');
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/en/reset-password',
    );
  });
});

test.describe('reset-password stub', () => {
  test('renders with a magic-link CTA in EN and AR', async ({ page }) => {
    for (const { code } of LOCALES) {
      await page.goto(`/${code}/reset-password`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(
        page.getByRole('link', { name: /back to sign in|العودة إلى تسجيل الدخول/ }),
      ).toHaveAttribute('href', `/${code}/login`);
    }
  });
});
