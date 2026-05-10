import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/trpc/routers';
import { createContext } from '@/server/trpc/trpc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createContext({ req }),
    onError({ error, path }) {
      // Production errors go to Sentry in Module 9; for now we log so
      // the Vercel runtime captures them.

      console.error(`[trpc] ${path ?? '<no-path>'}`, error);
    },
  });

export { handler as GET, handler as POST };
