import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Every public marketing route. Each is asserted to render in EN and AR
// without serious / critical axe violations, and to expose the right
// locale + dir attributes on <html>.

// /signup, /login, /reset-password covered by web/e2e/auth.spec.ts under
// the (auth) route group — keep them out of this list.
const ROUTES = [
  '',
  '/how-it-works',
  '/for-caregivers',
  '/for-therapists',
  '/about',
  '/team',
  '/security',
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

test('waitlist API (deprecated) still rejects malformed payloads', async ({ page }) => {
  // Deprecated in Module 1.5 but retained for in-flight requests; still
  // validates input properly.
  const res = await page.request.post('/api/waitlist', {
    data: { email: 'not-an-email', role: 'family' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test.describe('Module 1.5 pivot — free + open framing', () => {
  test('header exposes BOTH "Sign in" and "Get started" CTAs in EN', async ({ page }) => {
    await page.goto('/en');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: /sign in/i })).toHaveAttribute(
      'href',
      '/en/login',
    );
    await expect(header.getByRole('link', { name: /get started/i })).toHaveAttribute(
      'href',
      '/en/signup',
    );
  });

  test('header exposes both CTAs in AR with correct hrefs', async ({ page }) => {
    await page.goto('/ar');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: /تسجيل الدخول/ })).toHaveAttribute(
      'href',
      '/ar/login',
    );
    await expect(header.getByRole('link', { name: /ابدأ الآن/ })).toHaveAttribute(
      'href',
      '/ar/signup',
    );
  });

  test('hero primary CTA links to /signup, free caption is present', async ({ page }) => {
    await page.goto('/en');
    const hero = page.getByRole('main');
    await expect(
      hero.getByRole('link', { name: /get started — it's free/i }).first(),
    ).toHaveAttribute('href', '/en/signup');
    await expect(hero.getByText(/no credit card/i)).toBeVisible();
  });

  test('/pricing redirects to /signup with 308 (permanent)', async ({ page }) => {
    for (const locale of ['en', 'ar'] as const) {
      const res = await page.request.get(`/${locale}/pricing`, { maxRedirects: 0 });
      expect(res.status(), `expected 308 for /${locale}/pricing`).toBe(308);
      expect(res.headers()['location']).toMatch(new RegExp(`/${locale}/signup$`));
    }
  });

  test('sitemap excludes /pricing and includes /signup + /login', async ({ page }) => {
    const sitemap = await page.request.get('/sitemap.xml');
    const body = await sitemap.text();
    expect(body).not.toContain('/pricing');
    expect(body).toContain('/en/signup');
    expect(body).toContain('/ar/signup');
    expect(body).toContain('/en/login');
    expect(body).toContain('/ar/login');
  });

  test('Product JSON-LD on landing asserts InStock + price 0', async ({ page }) => {
    await page.goto('/en');
    const jsonLd = await page
      .locator('script[type="application/ld+json"]')
      .filter({ hasText: 'SoftwareApplication' })
      .first()
      .textContent();
    expect(jsonLd, 'Product JSON-LD should be present').toBeTruthy();
    const data = JSON.parse(jsonLd ?? '{}');
    expect(data.offers.availability).toBe('https://schema.org/InStock');
    expect(data.offers.price).toBe('0');
    expect(data.offers.priceCurrency).toBe('USD');
    expect(JSON.stringify(data)).not.toMatch(/PreOrder/);
  });

  test('footer Product column does NOT include a Pricing link', async ({ page }) => {
    await page.goto('/en');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('link', { name: /^pricing$/i })).toHaveCount(0);
  });
});
