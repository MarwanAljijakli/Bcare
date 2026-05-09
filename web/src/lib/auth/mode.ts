/**
 * Auth-mode detection. Determines at server boot (and module import on the
 * client) whether we have valid Supabase credentials and which backend the
 * /api/auth/* routes should call.
 *
 * Three modes:
 *   - real         : we have NEXT_PUBLIC_SUPABASE_URL + ANON_KEY → call Supabase
 *   - mock         : development build w/o credentials → in-memory simulation
 *   - unconfigured : production build w/o credentials → 503 from API routes
 *
 * The dev banner is shown ONLY in `mock` mode. In `unconfigured` mode the
 * banner stays hidden but the API returns a friendly 503; the operator should
 * set env vars on the host (Vercel project settings) to flip the mode to real.
 */

const HAS_SUPABASE_URL = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const HAS_SUPABASE_ANON = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const HAS_CREDENTIALS = HAS_SUPABASE_URL && HAS_SUPABASE_ANON;
const IS_PROD = process.env.NODE_ENV === 'production';

export type AuthMode = 'real' | 'mock' | 'unconfigured';

export const AUTH_MODE: AuthMode = HAS_CREDENTIALS ? 'real' : IS_PROD ? 'unconfigured' : 'mock';

/** Banner is shown ONLY in dev + mock mode. Production builds never show it. */
export const SHOW_DEV_BANNER: boolean = !IS_PROD && AUTH_MODE === 'mock';

/** One-line boot log. Imported once from each route handler / server entry. */
export function logAuthMode(label: string): void {
  console.info(`[bluecare/${label}] auth mode = ${AUTH_MODE}`);
}
