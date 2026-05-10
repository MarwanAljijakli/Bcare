/**
 * Pre-launch tear-down for the Module 2.A.1.bypass test caregiver.
 *
 * Wipes:
 *   • The auth.users row for dev-caregiver@bluecare.test.
 *   • Every public.* row that references it via FK (children, sessions,
 *     events, vocabulary, profiles, consent_records, etc.).
 *   • The dev caregiver's children's gamification_state, progress_metrics,
 *     custom_voices, vocabulary_suggestions — all cleared via FK cascade
 *     from children.
 *
 * The `consent_records` FK on `granted_by_id` is `on delete restrict`
 * (intentional — caregiver consent is part of the audit trail), so we
 * delete those rows explicitly first, then delete the dev user.
 *
 * Idempotent — re-running on a missing user is a no-op.
 *
 * Run this AFTER you've removed AUTH_BYPASS_USER_ID + NEXT_PUBLIC_AUTH_BYPASS
 * from every Vercel env scope so no live request can re-create the dev
 * caregiver between the env-var removal and the delete.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/delete-dev-caregiver.ts
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';

const DEV_EMAIL = 'dev-caregiver@bluecare.test';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !sr) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(2);
  }
  const supabase = createClient(url, sr, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) {
    console.error('listUsers failed:', list.error.message);
    process.exit(1);
  }
  const target = list.data.users.find(
    (u) => (u.email ?? '').toLowerCase() === DEV_EMAIL.toLowerCase(),
  );
  if (!target) {
    console.info(`No auth.users row for ${DEV_EMAIL} — nothing to delete.`);
    return;
  }
  const userId = target.id;
  console.info(`Deleting dev caregiver ${DEV_EMAIL} (id=${userId.slice(0, 8)}…)`);

  // FK-aware tear-down. consent_records uses on-delete-restrict; the
  // others cascade through children.
  console.info('  [1/4] consent_records');
  await (
    supabase.from('consent_records') as never as {
      delete: () => { eq: (col: string, v: string) => Promise<unknown> };
    }
  )
    .delete()
    .eq('granted_by_id', userId);

  console.info(
    '  [2/4] children + cascades (sessions/events/progress/gamification/voices/vocab/suggestions)',
  );
  await (
    supabase.from('children') as never as {
      delete: () => { eq: (col: string, v: string) => Promise<unknown> };
    }
  )
    .delete()
    .eq('caregiver_id', userId);

  console.info('  [3/4] profile');
  await (
    supabase.from('profiles') as never as {
      delete: () => { eq: (col: string, v: string) => Promise<unknown> };
    }
  )
    .delete()
    .eq('user_id', userId);

  console.info('  [4/4] public.users + auth.users');
  await (
    supabase.from('users') as never as {
      delete: () => { eq: (col: string, v: string) => Promise<unknown> };
    }
  )
    .delete()
    .eq('id', userId);
  const adminDel = await supabase.auth.admin.deleteUser(userId);
  if (adminDel.error) {
    console.warn(`auth.admin.deleteUser failed: ${adminDel.error.message}`);
  }

  console.info('\n✓ Dev caregiver removed.');
  console.info('  Verify next:');
  console.info('    1. /api/health/auth → bypassActive:false');
  console.info('    2. https://bcare-ten.vercel.app/en/signup → real form, no DevModeBanner');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
