/**
 * @real-network — hits the LIVE production deploy. Skipped in normal CI.
 *
 * Phase 10.C — production signup is email + password + confirmation.
 * This spec posts a throwaway-email + password against the real
 * Supabase project behind https://bcare-ten.vercel.app and asserts
 * the documented JSON success shape.
 *
 * Run manually or on a daily cron:
 *   pnpm test:e2e:real
 *
 * Skipped under normal `pnpm test:e2e` because it depends on external
 * network + Supabase + sends a real email.
 */

import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';

const LIVE_URL = process.env.PLAYWRIGHT_LIVE_BASE_URL ?? 'https://bcare-ten.vercel.app';
const RUN_REAL = process.env.RUN_REAL_NETWORK_TESTS === '1';

test.describe('real signup against the live deploy [@real-network]', () => {
  test.skip(!RUN_REAL, 'set RUN_REAL_NETWORK_TESTS=1 to run');

  test('POST /api/auth/signup with password + throwaway email returns 201 + ok:true', async ({
    request,
  }) => {
    const email = `e2e-real-${Date.now()}@bluecare.test`;
    const textHash = createHash('sha256').update('consent-text-2026-05-09.1').digest('hex');

    const res = await request.post(`${LIVE_URL}/api/auth/signup`, {
      data: {
        method: 'password',
        email,
        password: 'StrongPassw0rd-2026!',
        fullName: 'E2E Real Probe',
        role: 'family',
        consent: {
          granted: true,
          version: '2026-05-09.1',
          textHash,
        },
        locale: 'en',
      },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status()).toBeGreaterThanOrEqual(200);
    expect(res.status()).toBeLessThan(300);

    const body = (await res.json()) as { ok?: boolean; mode?: string; method?: string };
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('real');
    expect(body.method).toBe('password');
  });

  test('GET /api/health/auth returns ok:true, bypassActive:false, supabaseProject ref', async ({
    request,
  }) => {
    const res = await request.get(`${LIVE_URL}/api/health/auth`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      ok?: boolean;
      supabaseProject?: string;
      magicLinkOk?: boolean;
      bypassActive?: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.supabaseProject).toBe('ikaaxfhenfbpfjqboixk');
    expect(body.magicLinkOk).toBe(true);
    // Phase 10.C — production must never run with bypass active.
    expect(body.bypassActive).toBe(false);
  });
});
