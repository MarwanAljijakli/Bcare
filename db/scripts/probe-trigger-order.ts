/**
 * Reproduce the live-signup trigger-ordering bug via the admin API.
 * Creates an auth user with the EXACT raw_user_meta_data shape the
 * signup route emits — `consent.granted = true` plus version/text_hash.
 *
 * Expected: "Database error saving new user" if the trigger ordering
 * bug is real. The consent trigger (`on_auth_user_consent_signup`)
 * sorts alphabetically before `on_auth_user_created`, so it tries to
 * write a consent_records row pointing at a public.users row that
 * doesn't exist yet → FK violation → whole signup transaction fails.
 *
 * After fixing the bug, this script's invocation should succeed.
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, sr, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const ts = Date.now();
  const email = `trigger-probe-${ts}@bluecare.test`;

  console.info(`Creating auth user with consent.granted=true: ${email}`);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: 'Trigger Probe',
      role: 'family',
      locale: 'en',
      consent: {
        granted: true,
        version: '2026-05-09.1',
        text_hash: 'a'.repeat(64),
        granted_at: new Date().toISOString(),
      },
    },
  });

  if (error) {
    console.error('\n✗ admin.createUser failed:');
    console.error(`   ${error.message}`);
    console.error(`   status: ${error.status}`);
    process.exit(1);
  }
  console.info(`✓ admin.createUser succeeded — auth user id ${data.user?.id?.slice(0, 8)}…`);
  // Cleanup.
  if (data.user?.id) {
    await supabase.from('consent_records').delete().eq('granted_by_id', data.user.id);
    await supabase.from('users').delete().eq('id', data.user.id);
    await supabase.auth.admin.deleteUser(data.user.id);
    console.info('✓ cleanup complete');
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
