/**
 * Seed (or refresh) the development test caregiver. Idempotent.
 *
 * Used by Module 2.A.1.bypass — when AUTH_BYPASS_USER_ID is set on the
 * deployment, every visitor is auto-signed-in as this caregiver. RLS
 * stays fully enforced; we're just skipping the email handshake during
 * Modules 6–9 buildout so every page is testable in-browser without
 * email-loop ceremony.
 *
 * Creates / refreshes:
 *   • auth.users row for dev-caregiver@bluecare.test (email_confirmed_at=now)
 *   • The mirror trigger fans out:
 *       - public.users
 *       - public.consent_records (data_processing, ai_personalization)
 *   • public.profiles (caregiver role, locale en, "Test Caregiver")
 *   • public.children → "Sami", age 5, voice_id default, sensory default,
 *     parental_pin_hash bcrypt('0000')
 *   • Skips draft_onboarding (this user is past onboarding)
 *
 * Re-running never duplicates rows. Prints the auth.users.id on completion;
 * paste that into Vercel env as AUTH_BYPASS_USER_ID for production +
 * preview + development.
 *
 * Tear-down: db/scripts/delete-dev-caregiver.ts. Or simply delete the
 * auth.users row — every BlueCare table FKs to public.users.id which FKs
 * to auth.users.id (via the mirror), so a cascade clears it.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/seed-dev-caregiver.ts
 */

import './lib/env';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const DEV_EMAIL = 'dev-caregiver@bluecare.test';
const DEV_FULL_NAME = 'Test Caregiver';
const CHILD_NAME = 'Sami';
const CHILD_DOB = '2021-01-01'; // age 5 in 2026
const PIN_PLAINTEXT = '0000';

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

  // 1. Auth user — create if missing, fetch if existing.
  console.info(`[1/5] auth.users — ${DEV_EMAIL}`);
  let userId: string;
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) {
    console.error('listUsers failed:', list.error.message);
    process.exit(1);
  }
  const existing = list.data.users.find(
    (u) => (u.email ?? '').toLowerCase() === DEV_EMAIL.toLowerCase(),
  );
  if (existing) {
    userId = existing.id;
    console.info(`  = exists (id=${userId.slice(0, 8)}…)`);
  } else {
    const created = await supabase.auth.admin.createUser({
      email: DEV_EMAIL,
      email_confirm: true,
      user_metadata: {
        full_name: DEV_FULL_NAME,
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
    if (created.error || !created.data?.user) {
      console.error('createUser failed:', created.error?.message ?? 'no user');
      process.exit(1);
    }
    userId = created.data.user.id;
    console.info(`  ✓ created (id=${userId.slice(0, 8)}…)`);
  }

  // 2. Confirm public.users mirror exists. The trigger handles this on
  //    auth user create — but on existing-user re-runs we double-check.
  console.info('[2/5] public.users mirror');
  const mirror = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
  if (!mirror.data) {
    // Trigger should have fired; if it didn't (e.g. early signup before
    // the trigger landed), insert manually.
    await (
      supabase.from('users') as never as {
        insert: (row: { id: string; email: string; email_confirmed: boolean }) => Promise<unknown>;
      }
    ).insert({ id: userId, email: DEV_EMAIL, email_confirmed: true });
    console.info('  ✓ inserted (trigger missed it)');
  } else {
    console.info('  = exists');
  }

  // 3. Profile.
  console.info('[3/5] public.profiles');
  const profile = await (
    supabase.from('profiles') as never as {
      upsert: (row: {
        user_id: string;
        role: string;
        full_name: string;
        preferred_locale: string;
        preferred_theme: string;
        caregiver_relationship: string;
      }) => {
        select: (cols: string) => Promise<{
          data: { user_id: string }[] | null;
          error: { message: string } | null;
        }>;
      };
    }
  )
    .upsert({
      user_id: userId,
      role: 'caregiver',
      full_name: DEV_FULL_NAME,
      preferred_locale: 'en',
      preferred_theme: 'light',
      caregiver_relationship: 'parent',
    })
    .select('user_id');
  if (profile.error) {
    console.error('profile upsert failed:', profile.error.message);
    process.exit(1);
  }
  console.info('  ✓ upserted');

  // 4. Child — find existing by caregiver_id + full_name to keep idempotent.
  console.info('[4/5] public.children — Sami');
  const childLookup = await (
    supabase.from('children') as never as {
      select: (cols: string) => {
        eq: (
          col: string,
          v: string,
        ) => {
          eq: (
            col2: string,
            v2: string,
          ) => Promise<{
            data: { id: string }[] | null;
          }>;
        };
      };
    }
  )
    .select('id')
    .eq('caregiver_id', userId)
    .eq('full_name', CHILD_NAME);
  let childId: string;
  if (childLookup.data && childLookup.data.length > 0) {
    childId = childLookup.data[0]!.id;
    console.info(`  = exists (id=${childId.slice(0, 8)}…)`);
  } else {
    const pinHash = await bcrypt.hash(PIN_PLAINTEXT, 12);
    const childInsert = await (
      supabase.from('children') as never as {
        insert: (row: Record<string, unknown>) => {
          select: (cols: string) => Promise<{
            data: { id: string }[] | null;
            error: { message: string } | null;
          }>;
        };
      }
    )
      .insert({
        caregiver_id: userId,
        full_name: CHILD_NAME,
        preferred_name: CHILD_NAME,
        date_of_birth: CHILD_DOB,
        preferred_locale: 'en',
        preferred_theme: 'light',
        vocabulary_level: 'starter',
        voice_id: 'voice-warm',
        sensory_profile: {
          motion: 'full',
          audio: 'full',
          contrast: 'standard',
          touch: 'standard',
          fontScale: 1,
        },
        ai_suggestion_mode: 'review',
        parental_pin_hash: pinHash,
      })
      .select('id');
    if (childInsert.error || !childInsert.data?.[0]) {
      console.error('child insert failed:', childInsert.error?.message ?? 'no row');
      process.exit(1);
    }
    childId = childInsert.data[0].id;
    console.info(`  ✓ created (id=${childId.slice(0, 8)}…), PIN=${PIN_PLAINTEXT}`);
  }

  // 5. Consent records — ensure data_processing + ai_personalization both
  //    exist as `granted=true`. The auth-trigger fanout handles
  //    data_processing on create; ai_personalization is an opt-in scope
  //    we add explicitly so the dev caregiver can exercise the
  //    personalization surface.
  console.info('[5/5] public.consent_records');
  for (const scope of ['data_processing', 'ai_personalization'] as const) {
    const has = await (
      supabase.from('consent_records') as never as {
        select: (cols: string) => {
          eq: (
            col: string,
            v: string,
          ) => {
            eq: (
              col2: string,
              v2: string,
            ) => {
              eq: (
                col3: string,
                v3: boolean,
              ) => {
                limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
              };
            };
          };
        };
      }
    )
      .select('id')
      .eq('granted_by_id', userId)
      .eq('scope', scope)
      .eq('granted', true)
      .limit(1);
    if (has.data && has.data.length > 0) {
      console.info(`  = ${scope} already granted`);
      continue;
    }
    await (
      supabase.from('consent_records') as never as {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      }
    ).insert({
      granted_by_id: userId,
      subject_child_id: null,
      scope,
      granted: true,
      policy_version: '2026-05-09.1',
      metadata: { source: 'seed-dev-caregiver' },
    });
    console.info(`  ✓ ${scope} granted`);
  }

  console.info('\n=== AUTH_BYPASS_USER_ID ===');
  console.info(userId);
  console.info('\nNext steps:');
  console.info('  1. Add to web/.env.local:        AUTH_BYPASS_USER_ID=' + userId);
  console.info('  2. Add to web/.env.local:        NEXT_PUBLIC_AUTH_BYPASS=1');
  console.info('  3. vercel env add (production + preview + development) for both vars.');
  console.info('  4. vercel --prod --force.');
  console.info('  5. Visit https://bcare-ten.vercel.app/en — DevModeBanner should appear.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
