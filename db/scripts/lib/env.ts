/**
 * Strict .env.local loader — overrides any pre-set process.env values.
 *
 * Why: the Bcare workstation has stale `NEXT_PUBLIC_SUPABASE_URL` in the
 * PowerShell session env from a different project. Node's `--env-file`
 * flag explicitly does NOT override values that are already set in the
 * process env, so we'd silently connect to the wrong project. This loader
 * reads `web/.env.local` and writes every key into process.env regardless
 * of the prior value.
 *
 * Use at the top of every db/scripts/* script:
 *   import './lib/env';
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function repoRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // here = .../db/scripts/lib → up 3 = repo root
  return resolve(here, '..', '..', '..');
}

function loadEnvFile(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes (matches dotenv spec).
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) process.env[key] = value;
  }
}

const ENV_PATH = join(repoRoot(), 'web', '.env.local');
loadEnvFile(ENV_PATH);
