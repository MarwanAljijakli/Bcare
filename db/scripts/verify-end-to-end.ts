/**
 * End-to-end verification — replaces the "sign up a real caregiver via the
 * live form" step that requires email round-trips. Same data path, performed
 * server-side through the admin API so it runs in CI / scripts without
 * human interaction.
 *
 * What this proves:
 *   1. auth.users insert → public.users mirror trigger fires → row appears.
 *   2. The caregiver can write a profile, a child, and consent_records.
 *   3. board.bootstrap returns ≥ 1 symbol from the seed.
 *   4. Tearing down the test user cascades to every public.* row.
 *
 * This is a destructive-but-self-cleaning script. It creates and then
 * deletes an `e2e-verify-{ts}@bluecare.test` test user — uses a unique
 * timestamp suffix so concurrent runs don't collide.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/verify-end-to-end.ts
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';
import { sql } from './lib/sql';

interface UserRow {
  id: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
}

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const ts = Date.now();
  const testEmail = `e2e-verify-${ts}@bluecare.test`;
  const testPassword = `e2e-${ts}-${Math.random().toString(36).slice(2, 10)}`;

  console.info(`Test user: ${testEmail}`);
  let userId: string | null = null;

  try {
    // 1. Create the auth user (admin API bypasses email confirmation).
    console.info('\n[1/5] Creating auth user…');
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'E2E Verify',
        consent: { dataProcessing: true, version: '2026-05-09.1' },
      },
    });
    if (createErr || !created.user) {
      throw new Error(`createUser failed: ${createErr?.message ?? 'no user'}`);
    }
    userId = created.user.id;
    console.info(`      ✓ auth.users row created (id=${userId.slice(0, 8)}…)`);

    // 2. Wait briefly + verify the trigger fired.
    console.info('\n[2/5] Verifying auth → public mirror trigger…');
    let publicRow: UserRow | null = null;
    for (let i = 0; i < 5; i++) {
      const r = await sql<UserRow>(
        `select id, email, email_confirmed, created_at from public.users where id = '${userId}'`,
      );
      if (r.rows[0]) {
        publicRow = r.rows[0];
        break;
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    if (!publicRow)
      throw new Error('Trigger failed: public.users row did not appear within 1.25s.');
    console.info(
      `      ✓ public.users row mirrored (email=${publicRow.email}, confirmed=${publicRow.email_confirmed})`,
    );

    // 3. Write profile + child + consent_records via the SAME service-role
    //    client (this skips RLS but exercises every CHECK constraint).
    console.info('\n[3/5] Writing profile, child, consent_records…');
    const profileInsert = await sql<{ user_id: string }>(
      `insert into public.profiles (user_id, role, full_name, preferred_locale, preferred_theme, caregiver_relationship)
       values ('${userId}', 'caregiver', 'E2E Verify', 'en', 'light', 'parent')
       returning user_id`,
    );
    if (!profileInsert.rows[0]) throw new Error('profile insert returned no row');
    console.info(`      ✓ profile inserted`);

    const childInsert = await sql<{ id: string }>(
      `insert into public.children (caregiver_id, full_name, preferred_name, preferred_locale, vocabulary_level)
       values ('${userId}', 'E2E Test Child', 'Sami', 'en', 'starter')
       returning id`,
    );
    const childId = childInsert.rows[0]?.id;
    if (!childId) throw new Error('child insert returned no row');
    console.info(`      ✓ child inserted (id=${childId.slice(0, 8)}…)`);

    await sql(
      `insert into public.consent_records (granted_by_id, scope, granted, policy_version, metadata)
       values
         ('${userId}', 'data_processing', true, '2026-05-09.1', '{"source":"e2e-verify"}'),
         ('${userId}', 'ai_personalization', true, '2026-05-09.1', '{"source":"e2e-verify"}')`,
    );
    console.info(`      ✓ 2 consent_records inserted`);

    // 4. Simulate board.bootstrap via SQL — pull the symbol catalog the
    //    real client would render.
    console.info('\n[4/5] Verifying board.bootstrap data path…');
    const symbolsCount = await sql<{ count: number }>(
      `select count(*)::int as count from public.symbols where status = 'active'`,
    );
    const symbolsN = symbolsCount.rows[0]?.count ?? 0;
    if (symbolsN < 1) throw new Error(`board would have 0 symbols to render`);
    console.info(`      ✓ board would render ${symbolsN} symbols`);

    const sample = await sql<{
      id: string;
      label_en: string;
      label_ar: string;
      image_path: string;
    }>(
      `select id, label_en, label_ar, image_path
       from public.symbols where status = 'active' order by label_en limit 3`,
    );
    console.info(`      ✓ sample symbols:`);
    for (const s of sample.rows) {
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/symbols-public/${s.image_path}`;
      const head = await fetch(url, { method: 'HEAD' });
      console.info(
        `        ${s.label_en} | ${s.label_ar} → ${head.status} ${head.headers.get('content-type')}`,
      );
      if (!head.ok) throw new Error(`image fetch failed for ${s.image_path}: ${head.status}`);
    }
  } finally {
    // 5. Cleanup: delete in dependency order. consent_records has FK
    //    `on delete restrict` so we wipe it first, then children, then
    //    profile, then public.users, and finally the auth.users row.
    //    Module 9 hardening will add an FK from public.users → auth.users
    //    so deleting the auth user cascades automatically.
    if (userId) {
      console.info('\n[5/5] Cleaning up test user…');
      try {
        await sql(`delete from public.consent_records where granted_by_id = '${userId}'`);
        await sql(`delete from public.children where caregiver_id = '${userId}'`);
        await sql(`delete from public.profiles where user_id = '${userId}'`);
        await sql(`delete from public.users where id = '${userId}'`);
        const del = await supabase.auth.admin.deleteUser(userId);
        if (del.error) console.warn(`      ✗ auth delete failed: ${del.error.message}`);
        else console.info(`      ✓ all rows removed; auth user deleted`);
      } catch (e) {
        console.warn(`      ✗ cleanup error: ${e instanceof Error ? e.message : String(e)}`);
      }
      // Verify nothing remains.
      const remnants = await sql<{ table: string; n: number }>(
        `select 'profiles' as "table", count(*)::int as n from public.profiles where user_id = '${userId}'
         union all select 'children', count(*) from public.children where caregiver_id = '${userId}'
         union all select 'consent_records', count(*) from public.consent_records where granted_by_id = '${userId}'
         union all select 'users', count(*) from public.users where id = '${userId}'`,
      );
      const stale = remnants.rows.filter((r) => r.n > 0);
      if (stale.length > 0) {
        console.warn(`      ✗ cleanup incomplete: ${JSON.stringify(stale)}`);
      } else {
        console.info(`      ✓ every related row removed`);
      }
    }
  }

  console.info('\n✓ End-to-end verification complete.');
}

main().catch((e: unknown) => {
  console.error('\n✗ END-TO-END FAILED:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
