#!/usr/bin/env node
// scripts/sync-brand-assets.mjs
//
// Copies SVGs from /shared/brand to /web/public/brand at dev / build time so
// pages can reference them via /brand/* URLs without webpack having to import
// each one. Idempotent, fast, no deps.

import { mkdir, copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(repo, 'shared', 'brand');
const dst = path.join(repo, 'web', 'public', 'brand');

await mkdir(dst, { recursive: true });

const entries = await readdir(src);
let copied = 0;
for (const name of entries) {
  if (!name.endsWith('.svg') && !name.endsWith('.png') && !name.endsWith('.ico')) continue;
  const from = path.join(src, name);
  const to = path.join(dst, name);
  const fromStat = await stat(from);
  let toStat = null;
  try {
    toStat = await stat(to);
  } catch {
    // missing — will copy
  }
  if (toStat && toStat.mtimeMs >= fromStat.mtimeMs && toStat.size === fromStat.size) continue;
  await copyFile(from, to);
  copied += 1;
}
console.log(`✓ brand assets synced (${copied} updated, ${entries.length - copied} unchanged)`);
