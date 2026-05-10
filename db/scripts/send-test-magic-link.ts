/**
 * Send a real magic-link email through the EXACT same code path real
 * signups hit — no admin shortcuts, no implicit-flow Proxy URLs.
 *
 * Choice (Module 2.A.1.fix.3): we route through the live `/api/auth/login`
 * endpoint, which calls `supabase.auth.signInWithOtp({ shouldCreateUser:
 * false })`. That uses the PKCE flow and emits the action_link with a
 * `?code=...` query param routed through `/auth/callback`. This is what
 * a real user gets when they submit the login form.
 *
 * Why NOT supabase.auth.admin.generateLink({type:'magiclink', ...}):
 *   • That endpoint returns an IMPLICIT-flow URL (#access_token fragment).
 *   • Real production traffic uses PKCE.
 *   • Testing through generateLink hides bugs that only manifest in PKCE
 *     (Module 2.A.1.fix.2 hid a route-handler crash because the fragment-
 *     flow link bypassed the route entirely).
 *   • generateLink is also restricted to admin paths and is not how
 *     caregivers will sign back in.
 *
 * Usage (run from repo root):
 *   pnpm exec tsx db/scripts/send-test-magic-link.ts <email>
 *
 * The target email MUST already have an auth.users row (we use
 * shouldCreateUser:false, mirroring the production /login flow). If the
 * user doesn't exist yet, the script falls back to /api/auth/signup with
 * a synthetic full-name + family role + boilerplate consent payload.
 */

import './lib/env';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const LIVE_URL = process.env.PLAYWRIGHT_LIVE_BASE_URL ?? 'https://bcare-ten.vercel.app';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('usage: pnpm exec tsx db/scripts/send-test-magic-link.ts <email>');
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !sr) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(2);
  }

  // Check whether the email already has an auth user (use admin API).
  const supabase = createClient(url, sr, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) {
    console.error('listUsers failed:', list.error.message);
    process.exit(1);
  }
  const existing = list.data.users.find(
    (u) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
  );

  let endpoint: 'login' | 'signup';
  let body: Record<string, unknown>;
  if (existing) {
    endpoint = 'login';
    body = { method: 'magic-link', email, locale: 'en' };
    console.info(
      `Found existing auth user (id=${existing.id.slice(0, 8)}…). Using /api/auth/login.`,
    );
  } else {
    endpoint = 'signup';
    const textHash = createHash('sha256').update('consent-text-2026-05-09.1').digest('hex');
    body = {
      method: 'magic-link',
      email,
      fullName: 'Real Magic-Link Probe',
      role: 'family',
      consent: {
        granted: true,
        version: '2026-05-09.1',
        textHash,
      },
      locale: 'en',
    };
    console.info(
      `No existing auth user for ${email}. Using /api/auth/signup with default profile shape.`,
    );
  }

  // Primary path: hit the production /api endpoint. Same code path real
  // users get when they submit the form.
  const res = await fetch(`${LIVE_URL}/api/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.info(`POST ${LIVE_URL}/api/auth/${endpoint} → ${res.status}`);
  console.info(`Response: ${text.slice(0, 300)}`);

  if (res.ok) {
    console.info(`\n✓ Magic-link email sent to ${email} via the production ${endpoint} endpoint.`);
    console.info('  Click the link in your inbox — it should land on /en/onboarding/welcome.');
    console.info(
      '  If it 404s OR shows an error boundary, capture the URL + error and surface here.',
    );
    return;
  }

  if (res.status !== 429) {
    process.exit(1);
  }

  // Fallback when the in-memory per-IP limiter on /api/auth/login is hot
  // (e.g. after a verification storm). signInWithOtp goes through the
  // SAME Supabase backend the route handler calls, with the SAME PKCE
  // flow + the SAME email template + the SAME redirect_to → /auth/callback
  // pattern. Only the in-front /api rate limiter is bypassed; Supabase's
  // own SMTP rate limit still applies (4 emails / hour on the free tier).
  console.warn(
    '\n! /api endpoint per-IP rate limit hit. Falling back to direct signInWithOtp ' +
      '(same PKCE flow, same backend, same email — just bypasses the in-front limiter).',
  );
  const fallback = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${LIVE_URL}/auth/callback?next=/en/onboarding`,
      shouldCreateUser: !existing,
    },
  });
  if (fallback.error) {
    console.error(`✗ signInWithOtp fallback failed: ${fallback.error.message}`);
    if (fallback.error.status === 429 || /rate limit/i.test(fallback.error.message)) {
      console.error(
        'Supabase free-tier SMTP allows 4 emails / hour. Wait it out, or wire up a custom ' +
          'SMTP (Gmail app password / Resend free tier) — paused per master prompt.',
      );
    }
    process.exit(1);
  }
  console.info(`\n✓ Magic-link email sent to ${email} via direct signInWithOtp.`);
  console.info('  Click the link in your inbox — it should land on /en/onboarding/welcome.');
  console.info(
    '  If it 404s OR shows an error boundary, capture the URL + error and surface here.',
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
