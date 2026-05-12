/**
 * Revoke-dev-admin — pre-launch flip-back.
 *
 * Inverse of seed-dev-admin.ts. Demotes the dev-caregiver back to
 * role='caregiver' (their original role before the Module 7 promotion).
 * MUST run BEFORE removing AUTH_BYPASS_USER_ID from the Vercel env so
 * the bypass caregiver doesn't accidentally retain admin after the
 * bypass is gone (which would let a real user authenticate as that
 * account and have admin rights).
 *
 * The seed-dev-admin.ts run on 2026-05-12 logged old_role='caregiver'
 * in audit_log — we restore to that exact value. If a future operator
 * promoted a different account, they can override with --role <role>.
 *
 * Idempotent: if role is already non-admin, no-op.
 *
 * Usage (run from repo root):
 *   pnpm tsx db/scripts/revoke-dev-admin.ts            # restore to 'caregiver'
 *   pnpm tsx db/scripts/revoke-dev-admin.ts --role family
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  // CLI flag: --role <role> overrides the default restore target.
  let restoreRole = 'caregiver';
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--role' && args[i + 1]) {
      restoreRole = args[i + 1]!;
      i++;
    }
  }

  const userId = process.env.AUTH_BYPASS_USER_ID?.trim();
  if (!userId) {
    console.error('AUTH_BYPASS_USER_ID is not set in web/.env.local — nothing to demote.');
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

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, role')
    .eq('user_id', userId)
    .maybeSingle();
  if (profErr) {
    console.error('profiles read failed:', profErr.message);
    process.exit(1);
  }
  if (!profile) {
    console.error(`No public.profiles row for ${userId}.`);
    process.exit(3);
  }
  const oldRole = (profile as { role: string }).role;
  console.info(`Target current role: ${oldRole}`);

  if (oldRole !== 'admin') {
    console.info('Not currently admin — no-op.');
    return;
  }

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ role: restoreRole })
    .eq('user_id', userId);
  if (updErr) {
    console.error('profile UPDATE failed:', updErr.message);
    process.exit(1);
  }

  await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'admin_action',
    target_type: 'profiles',
    target_id: userId,
    metadata: {
      source: 'cli/revoke-dev-admin',
      old_role: oldRole,
      new_role: restoreRole,
      reason: 'Pre-launch flip-back — demoting dev-caregiver before bypass removal.',
    },
  });

  const { data: verify } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  console.info(`✓ Demoted to role=${(verify as { role: string } | null)?.role}.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
