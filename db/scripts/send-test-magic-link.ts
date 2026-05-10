/**
 * Phase 6 of Module 2.A.1.fix.2 — generate a real magic-link email so
 * the user can re-verify the fix end-to-end in their actual inbox.
 *
 * Uses supabase.auth.admin.generateLink with type='magiclink'. Unlike
 * generateLink-and-inspect (used by /api/health/auth), this script
 * triggers the actual mailer because we want the user to receive the
 * email and click it.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/send-test-magic-link.ts <email>
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('usage: pnpm exec tsx db/scripts/send-test-magic-link.ts <email>');
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, sr, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const baseUrl = 'https://bcare-ten.vercel.app';
  const redirectTo = `${baseUrl}/auth/callback?next=/en/onboarding`;
  const sendEmail = !process.argv.includes('--no-email');

  if (sendEmail) {
    // Try the real email flow first — uses Supabase's built-in SMTP.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
        data: {
          full_name: email.split('@')[0],
          role: 'family',
          locale: 'en',
          consent: {
            granted: true,
            version: '2026-05-09.1',
            text_hash: 'a'.repeat(64),
            granted_at: new Date().toISOString(),
          },
        },
      },
    });

    if (!error) {
      console.info(`✓ Magic-link email sent to ${email} via Supabase SMTP.`);
      console.info('  Click the link in the email; it should land on /en/onboarding/welcome.');
      return;
    }
    if (error.status === 429 || /rate limit/i.test(error.message)) {
      console.warn(
        `! Supabase SMTP rate-limited (${error.message}). Falling back to admin.generateLink — paste the URL below into a browser.`,
      );
    } else {
      console.error('signInWithOtp failed:', error.message);
      process.exit(1);
    }
  }

  // Fallback: admin.generateLink returns the URL without sending an email.
  // Caller pastes it into a browser. Same end-to-end behavior.
  const gen = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  });
  if (gen.error) {
    console.error('generateLink failed:', gen.error.message);
    process.exit(1);
  }
  const actionLink = gen.data.properties?.action_link;
  if (!actionLink) {
    console.error('generateLink returned no action_link');
    process.exit(1);
  }
  console.info(`\n✓ Magic-link generated for ${email}.`);
  console.info('  Paste this URL into a browser (it logs you in + lands on /en/onboarding):');
  console.info(`\n${actionLink}\n`);
  console.info('  Single-use. Expires in 1 hour. Do not share publicly.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
