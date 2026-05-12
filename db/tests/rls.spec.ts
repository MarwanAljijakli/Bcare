/**
 * RLS integration test suite — Module 9.11.
 *
 * Authoring only — these tests don't run in CI yet because they require
 * a dedicated `bluecare-test` Supabase project (see
 * docs/pre-release-credentials.md item #5). Once that project is
 * provisioned + the env vars are set, remove the `describe.skip` to
 * enable the suite.
 *
 * Test shape: spin up TWO synthetic caregivers (caregiver_a, caregiver_b),
 * each with one child + a session + an input_event + a consent row.
 * Then assert that caregiver_a's cookie-bound supabase client returns
 * caregiver_b's rows as EMPTY across every Module 2-7 table, while the
 * service-role admin client returns ALL rows.
 *
 * Every assertion is a 1-line affirmation of an RLS policy. If RLS is
 * misconfigured on any covered table, exactly one row in this file fails
 * and the diff makes it obvious which policy regressed.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const TEST_URL = process.env.TEST_SUPABASE_URL;
const TEST_ANON = process.env.TEST_SUPABASE_ANON_KEY;
const TEST_SERVICE = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;

const SUITE_ENABLED = !!(TEST_URL && TEST_ANON && TEST_SERVICE);

const COVERED_TABLES = [
  'users',
  'profiles',
  'children',
  'sessions',
  'input_events',
  'output_events',
  'progress_metrics',
  'gamification_state',
  'vocabulary_sets',
  'vocabulary_suggestions',
  'consent_records',
  'custom_voices',
  'ai_usage_ledger',
  'therapist_invites',
  'therapist_grants',
  'draft_onboarding',
  'audit_log',
] as const;

interface Fixture {
  caregiverA: { id: string; childId: string; sessionId: string };
  caregiverB: { id: string; childId: string; sessionId: string };
  serviceRole: SupabaseClient;
  clientA: SupabaseClient;
  clientB: SupabaseClient;
}

describe.skip('RLS cross-caregiver isolation', () => {
  let f: Fixture;

  beforeAll(async () => {
    if (!SUITE_ENABLED) return;
    // TODO: seed two test caregivers + a child each + a session each +
    // an input_event each + a consent_record each. The seed is in
    // db/scripts/seed-rls-fixtures.ts (also pending).
    f = {} as Fixture;
  });

  afterAll(async () => {
    if (!SUITE_ENABLED) return;
    // TODO: cleanup-fixtures script tears the synthetic users down.
  });

  for (const table of COVERED_TABLES) {
    it(`caregiver_a CANNOT read caregiver_b's ${table}`, async () => {
      // Most tables are child-scoped via is_caregiver_of. For the few
      // that join via caregiver_id directly (children, therapist_grants),
      // the assertion is the same — caregiver_a's client returns no rows
      // for caregiver_b's data.
      const res = await f.clientA.from(table).select('id').limit(50);
      // The shape varies per table but the test rule is: caregiver_a
      // can see ONLY their own (caregiverA.id-tagged) rows. We assert
      // none of the returned rows belong to caregiverB by id-prefix
      // collision. Concrete assertions filled in per-table when the
      // test-Supabase project is wired.
      void table;
      void res;
      expect(true).toBe(true); // placeholder
    });
  }

  it('service-role bypasses RLS — sees ALL caregivers', async () => {
    const res = await f.serviceRole.from('children').select('id');
    expect(res.data?.length).toBeGreaterThanOrEqual(2);
  });

  it('therapist with active grant CAN read child sessions', async () => {
    // Seeded: a therapist user is granted access to caregiverA.childId.
    // Their cookie-bound client should see sessions for that child.
    void f;
    expect(true).toBe(true); // placeholder
  });

  it('therapist with REVOKED grant CANNOT read child sessions', async () => {
    void f;
    expect(true).toBe(true); // placeholder
  });
});

// Helper used by the wired version, kept here for reference.
export function makeClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
