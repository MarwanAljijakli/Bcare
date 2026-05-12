/**
 * Critical flows E2E suite — Module 9.12.
 *
 * Each test in this file maps 1:1 to a row in `docs/critical-flows.md`.
 * Tests are scaffolded — they describe the gestures + assertions and
 * use `test.skip()` so they don't fail CI until the infrastructure is
 * wired (test-Supabase project, deterministic seed, etc.). Removing
 * `.skip` enables a test once its preconditions are met.
 *
 * RTL parity: every test runs in EN and AR via the `projects` fanout
 * in `playwright.config.ts`. The locale enters via the URL prefix.
 */

import { expect, test } from '@playwright/test';

const LOCALES = ['en', 'ar'] as const;

for (const locale of LOCALES) {
  test.describe(`Critical flows · ${locale.toUpperCase()}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.context().clearCookies();
    });

    // ─────────────────────────────────────────────────────────────────
    // #1 Caregiver signs up, verifies email, lands on onboarding.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`signup → magic-link → onboarding (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/signup`);
      await page.getByLabel(/email/i).fill('e2e+signup@bluecare.test');
      await page.getByLabel(/full name/i).fill('Test Caregiver');
      await page.getByRole('checkbox', { name: /consent/i }).check();
      await page.getByRole('button', { name: /sign up/i }).click();
      // TODO(test-infra): fetch + click magic link via supabase admin
      await expect(page).toHaveURL(new RegExp(`/${locale}/onboarding`));
    });

    // ─────────────────────────────────────────────────────────────────
    // #2 Caregiver completes onboarding wizard for a child profile.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`onboarding wizard end-to-end (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/onboarding/welcome`);
      // Walk all 8 steps. TODO(test-infra): seed a draft session.
      for (const step of [
        'about-you',
        'about-child',
        'sensory',
        'vocabulary-level',
        'voice',
        'consent',
        'pin',
        'review',
      ]) {
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.getByRole('button', { name: /next|review|finish/i }).click();
        await expect(page).toHaveURL(new RegExp(`/onboarding/${step}|/dashboard`));
      }
    });

    // ─────────────────────────────────────────────────────────────────
    // #3 Therapist accepts invite + views child dashboard.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`therapist invite accept + caseload tile (${locale})`, async ({ page }) => {
      // TODO(test-infra): seed an invite + sign in as a 2nd user.
      await page.goto(`/${locale}/accept-invite/AAAA-BBBB-CCCC`);
      await expect(page.getByText(/accepted/i)).toBeVisible();
      await page.goto(`/${locale}/therapist`);
      await expect(page.getByRole('heading', { name: /caseload|قائمة/i })).toBeVisible();
    });

    // ─────────────────────────────────────────────────────────────────
    // #4 Child opens the AAC board, taps a symbol, hears TTS.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`board tap → TTS playback (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/board`);
      const tile = page.getByRole('button', { name: /apple|تفاح/i }).first();
      await tile.click();
      // TODO(test-infra): assert sentence-strip token + speak button enabled.
      await page.getByRole('button', { name: /speak|تحدّث/i }).click();
      // Audio playback assertion is browser-dependent; check the cache hit
      // via network response.
    });

    // ─────────────────────────────────────────────────────────────────
    // #5 Hold-to-speak transcript → sentence strip.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`board hold-to-speak (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/board`);
      // TODO(test-infra): mock MediaRecorder + fake the Whisper response.
      await page.getByRole('button', { name: /hold to speak|اضغط/i }).click();
    });

    // ─────────────────────────────────────────────────────────────────
    // #6 Pinch gesture → tile select.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`board pinch gesture (${locale})`, async ({ page }) => {
      // TODO(test-infra): feature flag + fake-camera permissions. The
      // gesture mode is off by default; this test would enable it via
      // the settings + simulate the MediaPipe output.
      void page;
    });

    // ─────────────────────────────────────────────────────────────────
    // #7 Caregiver reviews an AI suggestion.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`dashboard suggestion approve (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/dashboard/personalization`);
      const approve = page.getByRole('button', { name: /approve|قبول/i }).first();
      await approve.click();
      await expect(page.getByRole('button', { name: /approve|قبول/i }).first()).not.toBeVisible();
    });

    // ─────────────────────────────────────────────────────────────────
    // #8 Custom symbol upload with bilingual labels.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`custom symbol upload (${locale})`, async ({ page }) => {
      // TODO(test-infra): upload a stubbed PNG fixture.
      await page.goto(`/${locale}/dashboard/vocabulary`);
      void page;
    });

    // ─────────────────────────────────────────────────────────────────
    // #9 30-day PDF report export.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`reports PDF download (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/dashboard/reports`);
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('link', { name: /download/i }).click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/^bluecare-.*\.pdf$/);
    });

    // ─────────────────────────────────────────────────────────────────
    // #10 Quiet mode — no motion, no sound.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`board quiet mode (${locale})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(`/${locale}/board`);
      // TODO(test-infra): assert sentence-strip transitions don't animate
      // and Speak emits zero audio when quiet mode is on.
      void page;
    });

    // ─────────────────────────────────────────────────────────────────
    // #11 GDPR data export + account delete.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`account export + delete (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/settings/privacy`);
      // TODO(test-infra): recent-auth gate — sign in fresh first.
      await page.getByRole('button', { name: /export|تصدير/i }).click();
      // Verify a JSON file download triggered.
    });

    // ─────────────────────────────────────────────────────────────────
    // #12 Admin moderates a pending_review symbol.
    // ─────────────────────────────────────────────────────────────────
    test.skip(`admin symbol approve (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}/admin/symbols`);
      const approve = page.getByRole('button', { name: /approve|موافقة/i }).first();
      await approve.click();
    });
  });
}
