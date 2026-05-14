/**
 * One-off applier for migration 0013_progress_reports.sql after the
 * full-tree apply-migrations.ts stopped on a fixed RLS policy. Uses the
 * same splitStatements + already-exists handling as the canonical
 * runner, so re-running is safe.
 */

import './lib/env';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from './lib/sql';

function splitStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let buf = '';
  let inDollar = false;
  let dollarTag = '';

  for (let i = 0; i < sqlText.length; i++) {
    const ch = sqlText[i];
    if (!inDollar) {
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
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, '..', 'migrations', '0013_progress_reports.sql');
  const text = await readFile(path, 'utf8');
  const stmts = splitStatements(text);
  console.info(`[apply-0013] ${stmts.length} statement(s).`);

  let i = 0;
  let skipped = 0;
  let ok = 0;
  for (const s of stmts) {
    i++;
    try {
      await sql(s);
      ok++;
      console.info(`  ✓ ${i}: ${s.slice(0, 60).replace(/\s+/g, ' ')}…`);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (/already exists/i.test(err.message)) {
        skipped++;
        console.info(`  = ${i}: skipped (already exists)`);
        continue;
      }
      console.error(`\n  ✗ Statement ${i} failed.`);
      console.error(`  --- statement ---`);
      console.error(s);
      console.error(`  --- error ---`);
      console.error(err.message);
      process.exit(1);
    }
  }
  console.info(`\n[apply-0013] done. ${ok} applied, ${skipped} already-exists skipped.`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack : String(e));
  process.exit(1);
});
