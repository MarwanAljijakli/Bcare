import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Every public marketing route. Each is asserted to render in EN and AR
// without serious / critical axe violations, and to expose the right
// locale + dir attributes on <html>.

const ROUTES = [
  '',
  '/how-it-works',
  '/for-caregivers',
  '/for-therapists',
  '/about',
  '/team',
  '/security',
  '/pricing',
  '/privacy',
  '/terms',
  '/accessibility',
  '/contact',
] as const;

const LOCALES = [
  { code: 'en', dir: 'ltr' },
  { code: 'ar', dir: 'rtl' },
] as const;

test.describe('marketing routes — bilingual + a11y', () => {
  for (const { code, dir } of LOCALES) {
    for (const path of ROUTES) {
      test(`renders /${code}${path} in ${dir} with no axe blockers`, async ({ page }) => {
        await page.goto(`/${code}${path}`);
        await expect(page.locator('html')).toHaveAttribute('lang', code);
        await expect(page.locator('html')).toHaveAttribute('dir', dir);
        // h1 present (or h2 if the legal pages drop the h1 — but every page has one).
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

test('language toggle on landing preserves the path and flips dir', async ({ page }) => {
  await page.goto('/en/how-it-works');
  await page.getByRole('button', { name: /العربية/ }).click();
  await expect(page).toHaveURL(/\/ar\/how-it-works$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.getByRole('button', { name: /English/ }).click();
  await expect(page).toHaveURL(/\/en\/how-it-works$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('robots.txt and sitemap.xml are reachable and well-formed', async ({ page }) => {
  const robots = await page.request.get('/robots.txt');
  expect(robots.ok()).toBeTruthy();
  const robotsBody = await robots.text();
  expect(robotsBody).toContain('Sitemap');

  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.ok()).toBeTruthy();
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain('<urlset');
  // Both locale prefixes should appear.
  expect(sitemapBody).toContain('/en');
  expect(sitemapBody).toContain('/ar');
});

test('OG image route returns a PNG for a given locale', async ({ page }) => {
  const og = await page.request.get('/api/og?locale=ar&title=test');
  expect(og.ok()).toBeTruthy();
  expect(og.headers()['content-type']).toContain('image/png');
});

test('waitlist API rejects malformed payloads', async ({ page }) => {
  const res = await page.request.post('/api/waitlist', {
    data: { email: 'not-an-email', role: 'family' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});
