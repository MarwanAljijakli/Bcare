import './lib/env';
import { sql } from './lib/sql';

async function main(): Promise<void> {
  // Clean up any leftover e2e-verify-* test users from incomplete runs.
  const before = await sql<{ n: number }>(
    `select count(*)::int as n from public.users where email like 'e2e-verify-%@bluecare.test'`,
  );
  console.info('stale e2e users:', before.rows[0]?.n);
  if ((before.rows[0]?.n ?? 0) > 0) {
    // The consent_records FK is `on delete restrict` (intentional — consent
    // is part of the audit trail and must never auto-disappear). For test
    // teardown we need to wipe the dependents first.
    const targetIds = `(select id from public.users where email like 'e2e-verify-%@bluecare.test')`;
    await sql(`delete from public.consent_records where granted_by_id in ${targetIds}`);
    await sql(`delete from public.children where caregiver_id in ${targetIds}`);
    await sql(`delete from public.profiles where user_id in ${targetIds}`);
    await sql(`delete from public.users where email like 'e2e-verify-%@bluecare.test'`);
    const after = await sql<{ n: number }>(
      `select count(*)::int as n from public.users where email like 'e2e-verify-%@bluecare.test'`,
    );
    console.info('after cleanup:', after.rows[0]?.n);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
