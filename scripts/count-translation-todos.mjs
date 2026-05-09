#!/usr/bin/env node
// scripts/count-translation-todos.mjs
//
// Counts every `TODO(translate)` marker in the repo (in code AND in docs/
// translation-review.md "Pending review" rows). Fails CI when the count
// exceeds CONFIG.threshold so we engage a native Arabic reviewer before
// the debt becomes painful.
//
// Triggered manually with `pnpm lint:i18n-debt` or in CI alongside lint.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { glob } from 'glob';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CONFIG = {
  threshold: 25,
  // Where to scan for code-level TODO(translate) markers.
  codeGlobs: ['web/**/*.{ts,tsx,json}', 'shared/**/*.{ts,json}'],
  // Where to scan for translation-review pending rows.
  reviewFile: 'docs/translation-review.md',
  ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/storybook-static/**'],
};

let codeCount = 0;
const codeFiles = await glob(CONFIG.codeGlobs, {
  cwd: repo,
  ignore: CONFIG.ignore,
  absolute: true,
});
for (const file of codeFiles) {
  const text = await readFile(file, 'utf8');
  const matches = text.match(/TODO\(translate\)/g);
  if (matches) codeCount += matches.length;
}

let reviewCount = 0;
try {
  const review = await readFile(path.join(repo, CONFIG.reviewFile), 'utf8');
  // Count rows in the "Pending review" table — lines that start with `|` and
  // contain at least one Arabic-script character.
  const arabic = /[؀-ۿ]/;
  let inPending = false;
  for (const line of review.split('\n')) {
    if (line.includes('## Pending review')) inPending = true;
    else if (line.startsWith('## ') && inPending) inPending = false;
    if (!inPending) continue;
    if (line.startsWith('|') && arabic.test(line) && !line.includes('---')) {
      reviewCount++;
    }
  }
} catch {
  // If the file disappears, skip — code count is still authoritative.
}

const total = codeCount + reviewCount;
const ok = total <= CONFIG.threshold;
console.log(
  `${ok ? '✓' : '✖'} translation debt: ${total} (code=${codeCount}, review=${reviewCount}, threshold=${CONFIG.threshold})`,
);
if (!ok) {
  console.error(
    `\nTranslation debt exceeds ${CONFIG.threshold}. Engage a native Arabic reviewer before adding more strings.`,
  );
  process.exit(1);
}
