/**
 * Admin invite — CLI-only. There is NO admin self-service signup; the
 * BlueCare master prompt mandates invite-only admin creation.
 *
 * Usage (run from repo root):
 *   pnpm tsx db/scripts/invite-admin.ts <email>
 *
 * What it does:
 *   1. Validates DATABASE_URL + NEXT_PUBLIC_SUPABASE_URL +
 *      SUPABASE_SERVICE_ROLE_KEY are present.
 *   2. Looks up the auth user by email. Errors if no user with that email
 *      has ever signed in (the operator should ask them to sign up first).
 *   3. Upserts a row in public.profiles with role='admin'.
 *   4. Writes an audit_log row of action='admin_action' / target='profiles'.
 *
 * Outputs nothing sensitive. Idempotent — re-running is safe.
 */

import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('usage: pnpm tsx db/scripts/invite-admin.ts <email>');
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

  // Look up the user by email via auth admin API.
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error('Failed to list users:', listErr.message);
    process.exit(1);
  }
  const target = list.users.find((u) => (u.email ?? '').toLowerCase() === email);
  if (!target) {
    console.error(`No user signed up with ${email}. Ask them to sign up first, then re-run.`);
    process.exit(3);
  }

  // Upsert profile.
  const { error: profErr } = await supabase.from('profiles').upsert(
    {
      user_id: target.id,
      role: 'admin',
      full_name: target.user_metadata?.full_name ?? email,
    },
    { onConflict: 'user_id' },
  );
  if (profErr) {
    console.error('Profile upsert failed:', profErr.message);
    process.exit(1);
  }

  // Audit-log the action. The actor is "system" — we use a null actor_id
  // and a marker in metadata.
  await supabase.from('audit_log').insert({
    actor_id: null,
    action: 'admin_action',
    target_type: 'profiles',
    target_id: target.id,
    metadata: { source: 'cli/invite-admin', email },
  });

  console.log(`✓ ${email} is now an admin (profiles.role=admin).`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
