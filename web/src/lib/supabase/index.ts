// Public re-exports. The server module imports `next/headers`, which throws if
// pulled into a client bundle, so it stays separate. Consumers import the
// flavor they need.
export { getSupabaseBrowserClient } from './client';
export type { Database } from './types';
