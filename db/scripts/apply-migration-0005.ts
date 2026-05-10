/**
 * Direct apply of migration 0005 — extend ai_service enum.
 *
 * Quality Fix Phase 0.9. The full migration runner
 * (db/scripts/apply-migrations.ts) was timing out on rls/policies due
 * to a transient Supabase pooler hiccup; we don't want to gate Phase 1
 * on a re-run that may take 5+ minutes when this single migration
 * lands in <1 second via the REST endpoint.
 *
 * This script is one-off — once 0005 is applied, the next regular run
 * of apply-migrations.ts will note it's already in place and skip.
 *
 * Usage:
 *   pnpm exec tsx db/scripts/apply-migration-0005.ts
 */
import './lib/env';

const SQL = [
  "alter type public.ai_service add value if not exists 'claude_suggest';",
  "alter type public.ai_service add value if not exists 'claude_audit';",
  "alter type public.ai_service add value if not exists 'claude_complete';",
  "alter type public.ai_service add value if not exists 'claude_other';",
];

async function main(): Promise<void> {
  const projectRef = (() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
    return m ? m[1]! : null;
  })();
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!projectRef || !accessToken) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_ACCESS_TOKEN. Cannot apply migration via Management API.',
    );
    process.exit(1);
  }

  for (const stmt of SQL) {
    console.info(`[apply] ${stmt}`);
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: stmt }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`  ✗ failed (${res.status}): ${body}`);
      process.exit(1);
    }
    console.info('  ✓ applied');
  }
  console.info('\n=== migration 0005 applied ===');
  console.info(
    'ai_service enum now includes: claude_suggest, claude_audit, claude_complete, claude_other',
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
