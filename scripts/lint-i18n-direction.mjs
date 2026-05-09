#!/usr/bin/env node
// scripts/lint-i18n-direction.mjs
//
// Fails CI if any TS/TSX file under web/src or web/app uses Tailwind directional
// classes that break in RTL. Use `start-`, `end-`, `ms-`, `me-`, `ps-`, `pe-`,
// `text-start`, `text-end` instead. Long-form CSS `margin-inline-start` is also
// fine — they're flow-relative.
//
// We scan for raw class strings rather than parsing JSX, which is plenty for
// the current rule set.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { glob } from 'glob';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const include = ['web/src/**/*.{ts,tsx}', 'web/app/**/*.{ts,tsx}'];
const ignore = ['**/node_modules/**', '**/.next/**', '**/storybook-static/**'];

// Forbidden patterns (whole-token only). Matches Tailwind directional utilities.
const forbidden = [
  // ml-, mr-, pl-, pr-
  /\b(ml|mr|pl|pr)-[\w./-]+/g,
  // left-, right- spacing helpers (positioning is flow-relative-only)
  /(?<![a-z])(left|right)-[\w./-]+/g,
  // text-left, text-right
  /\btext-(left|right)\b/g,
  // border-l, border-r (and their -<width>)
  /\bborder-(l|r)(-[\w./-]+)?\b/g,
  // rounded-l-, rounded-r-, rounded-tl-, etc. (use start/end forms)
  /\brounded-(l|r|tl|bl|tr|br)(-[\w./-]+)?\b/g,
];

const tokenAllowList = new Set([
  // these tokens look like ml-/mr- but are actually unrelated identifiers in code
]);

const files = await glob(include, { cwd: repoRoot, ignore, absolute: true });

let violations = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const pattern of forbidden) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const token = m[0];
      if (tokenAllowList.has(token)) continue;
      // Skip matches inside import paths or comments quickly.
      const start = m.index;
      const lineStart = text.lastIndexOf('\n', start) + 1;
      const line = text.slice(lineStart, text.indexOf('\n', start));
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
      const lineNo = text.slice(0, start).split('\n').length;
      const rel = path.relative(repoRoot, file);
      console.error(`${rel}:${lineNo}: directional class "${token}" — use start/end equivalents`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n✖ ${violations} directional-class violation(s). RTL parity is mandatory.`);
  process.exit(1);
}
console.log('✓ i18n direction lint passed.');
