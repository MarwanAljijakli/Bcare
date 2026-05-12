/**
 * Seed-dev-admin — Module 7 bypass enablement.
 *
 * Promotes the dev-caregiver user (the one AUTH_BYPASS_USER_ID points at)
 * to role='admin' so the /admin pages are reachable during the Module 7-9
 * buildout. The bypass cookie auths every request as that user, so without
 * this promotion the admin route guard would redirect back to /dashboard.
 *
 * Idempotent: re-running is safe. Logs the old role before the change so
 * the rollback script (revoke-dev-admin.ts) has a reference.
 *
 * Pre-launch rollback: db/scripts/revoke-dev-admin.ts flips role back to
 * 'family' (or whatever the original role was before promotion). Run that
 * BEFORE removing AUTH_BYPASS_USER_ID from the env.
 *
 * Usage (run from repo root):
 *   pnpm tsx db/scripts/seed-dev-admin.ts
 *
 * Resolves the target user_id from process.env.AUTH_BYPASS_USER_ID, NOT
 * hardcoded. Errors out cleanly if the env var is missing or the user
 * doesn't exist in public.profiles.
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const userId = process.env.AUTH_BYPASS_USER_ID?.trim();
  if (!userId) {
    console.error('AUTH_BYPASS_USER_ID is not set in web/.env.local — nothing to promote.');
    process.exit(2);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    console.error(`AUTH_BYPASS_USER_ID does not look like a UUID: ${userId}`);
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(2);
  }

  const supabase = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verify the target exists in public.profiles AND auth.users.
  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    console.error(`No auth.users row for ${userId}: ${authErr?.message ?? 'not found'}`);
    process.exit(3);
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, role, full_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (profErr) {
    console.error('profiles read failed:', profErr.message);
    process.exit(1);
  }
  if (!profile) {
    console.error(
      `No public.profiles row for ${userId}. The user has signed up to auth.users but the mirror trigger didn't fire (or this is a fresh-install bypass). Aborting — promote only existing profiles.`,
    );
    process.exit(3);
  }
  const oldRole = (profile as { role: string }).role;
  console.info(`Target: ${authUser.user.email ?? userId} (current role=${oldRole})`);

  if (oldRole === 'admin') {
    console.info('Already an admin — no-op.');
    return;
  }

  // 2. UPDATE profiles.role = 'admin'. Service-role bypasses RLS.
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('user_id', userId);
  if (updErr) {
    console.error('profile UPDATE failed:', updErr.message);
    process.exit(1);
  }

  // 3. Audit-log the promotion.
  await supabase.from('audit_log').insert({
    actor_id: null, // CLI / system action — no caller user.
    action: 'admin_action',
    target_type: 'profiles',
    target_id: userId,
    metadata: {
      source: 'cli/seed-dev-admin',
      old_role: oldRole,
      new_role: 'admin',
      reason: 'Module 7 bypass enablement — reachability of /admin pages under AUTH_BYPASS.',
    },
  });

  // 4. Verify by re-reading.
  const { data: verify } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  const newRole = (verify as { role: string } | null)?.role;
  if (newRole !== 'admin') {
    console.error(`Promotion verification failed: role is "${newRole}" after update.`);
    process.exit(1);
  }

  console.info(`✓ ${authUser.user.email ?? userId} is now an admin.`);
  console.info(`  old_role=${oldRole}  new_role=admin`);
  console.info('Run db/scripts/revoke-dev-admin.ts BEFORE removing AUTH_BYPASS_USER_ID.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
