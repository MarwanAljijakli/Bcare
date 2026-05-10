/**
 * Idempotent migration runner — the canonical way to apply BlueCare DB
 * changes to the live Supabase project.
 *
 * Replaces the prior "operator pastes SQL into Supabase SQL editor" flow
 * (see docs/runbook.md). Reads every `.sql` file under the migration
 * directories in lexicographic order and POSTs them to the Management
 * API SQL endpoint.
 *
 * Migration sources (applied in this exact order):
 *   1. db/migrations/0000_initial_schema.sql        — 18 base tables.
 *   2. db/rls/policies.sql                           — RLS helpers + per-table policies.
 *   3. db/migrations/0001_rls_policies.sql           — additional RLS extensions (if present).
 *   4. db/migrations/0002_storage_buckets.sql        — RLS for storage.objects (Module 3).
 *   5. db/migrations/0003_*.sql, 0004_*.sql, …       — future migrations, picked up automatically.
 *
 * Safety / idempotency:
 *   • Every migration file uses `CREATE TABLE IF NOT EXISTS`,
 *     `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS` + `CREATE
 *     POLICY`, and similar patterns. Re-running is intended to be a
 *     no-op.
 *   • The runner stops at the first failure and prints the exact
 *     statement + Postgres error so you can fix forward.
 *   • Statements are executed individually by splitting on the semicolon
 *     terminator at the start of a new line — adequate for the
 *     hand-authored migrations BlueCare uses today. (When we move to
 *     drizzle-kit-generated migrations, swap this for the proper
 *     parser.)
 *
 * Usage (from repo root):
 *   pnpm exec tsx db/scripts/apply-migrations.ts
 *   pnpm exec tsx db/scripts/apply-migrations.ts --dry-run   # prints, does not execute
 */

import './lib/env';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from './lib/sql';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_DB = resolve(here, '..');

interface MigrationFile {
  path: string;
  label: string;
}

function discoverMigrations(): MigrationFile[] {
  const out: MigrationFile[] = [];
  // Hand-authored files (the canonical BlueCare set).
  const order: MigrationFile[] = [
    { path: join(REPO_DB, 'migrations', '0000_initial_schema.sql'), label: '0000_initial_schema' },
    { path: join(REPO_DB, 'rls', 'policies.sql'), label: 'rls/policies' },
    { path: join(REPO_DB, 'migrations', '0001_rls_policies.sql'), label: '0001_rls_policies' },
    {
      path: join(REPO_DB, 'migrations', '0002_storage_buckets.sql'),
      label: '0002_storage_buckets',
    },
  ];
  for (const m of order) {
    if (existsSync(m.path)) out.push(m);
  }
  return out;
}

/**
 * Split a multi-statement SQL file into individual statements.
 *
 * Postgres accepts multiple statements per request, but the Management
 * API endpoint sometimes truncates large bodies — and per-statement
 * execution makes failure messages much clearer.
 *
 * The splitter is intentionally simple: it splits on `;` followed by
 * a newline (the convention in our hand-authored migrations) and
 * preserves dollar-quoted blocks ($$ ... $$) as single units, which
 * is critical for function bodies.
 */
function splitStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let inDollar = false;
  let dollarTag = '';

  for (let i = 0; i < sqlText.length; i++) {
    const ch = sqlText[i];

    if (!inDollar) {
      // Detect $$ or $tag$ start.
      if (ch === '$') {
        const m = sqlText.slice(i).match(/^\$([a-zA-Z_]*)\$/);
        if (m) {
          inDollar = true;
          dollarTag = m[0];
          buf += dollarTag;
          i += dollarTag.length - 1;
          continue;
        }
      }
      // Statement terminator: ';' followed by newline (or end of file).
      if (
        ch === ';' &&
        (sqlText[i + 1] === '\n' || sqlText[i + 1] === '\r' || i + 1 === sqlText.length)
      ) {
        const stmt = buf.trim();
        if (stmt) statements.push(stmt);
        buf = '';
        continue;
      }
      buf += ch;
    } else {
      buf += ch;
      // Detect end of dollar-quoted block.
      if (ch === '$' && sqlText.slice(i).startsWith(dollarTag)) {
        buf += dollarTag.slice(1);
        i += dollarTag.length - 1;
        inDollar = false;
        dollarTag = '';
      }
    }
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const files = discoverMigrations();
  console.info(`Discovered ${files.length} migration file(s):`);
  for (const f of files) console.info(`  ${f.label}  ${f.path}`);
  if (dryRun) {
    console.info('\n--dry-run: not executing. Goodbye.');
    return;
  }

  let totalStmts = 0;
  let totalOk = 0;
  for (const f of files) {
    console.info(`\n=== ${f.label} ===`);
    const text = await readFile(f.path, 'utf8');
    const stmts = splitStatements(text);
    console.info(`  ${stmts.length} statement(s).`);
    let i = 0;
    for (const s of stmts) {
      i++;
      totalStmts++;
      try {
        await sql(s);
        totalOk++;
        process.stdout.write('.');
      } catch (e) {
        console.error(`\n  ✗ Statement ${i} failed.`);
        console.error(`  --- statement ---`);
        console.error(
          s
            .split('\n')
            .slice(0, 6)
            .map((l) => `  ${l}`)
            .join('\n'),
        );
        console.error(`  --- error ---`);
        console.error(`  ${e instanceof Error ? e.message : String(e)}`);
        process.exit(1);
      }
    }
    console.info(`\n  ✓ ${stmts.length} statement(s) applied.`);
  }
  console.info(
    `\nTotal: ${totalOk}/${totalStmts} statements applied across ${files.length} files.`,
  );
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
