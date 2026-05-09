# Deploy

> Target hosts: **Vercel** (web) + **Supabase** (Postgres / Auth / Storage / Realtime).
> One-command deploy from a fresh clone is acceptance criterion #16.

## Environment variables

`web/.env.example` is the canonical list. **Names only — never check in values.**

| Var                               | Side   | Source                            | Module |
| --------------------------------- | ------ | --------------------------------- | ------ |
| `NEXT_PUBLIC_APP_URL`             | public | own                               | 0      |
| `NEXT_PUBLIC_SUPABASE_URL`        | public | Supabase project URL              | 0      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | public | Supabase project anon key         | 0      |
| `DATABASE_URL`                    | server | Supabase pooled connection string | 0      |
| `SUPABASE_SERVICE_ROLE_KEY`       | server | Supabase project service-role key | 0      |
| `SUPABASE_JWT_SECRET`             | server | Supabase auth JWT secret          | 2      |
| `OPENAI_API_KEY`                  | server | platform.openai.com               | 3 / 4  |
| `ELEVENLABS_API_KEY`              | server | elevenlabs.io                     | 3      |
| `AZURE_TTS_KEY`                   | server | portal.azure.com                  | 3      |
| `AZURE_TTS_REGION`                | server | portal.azure.com                  | 3      |
| `AI_MONTHLY_BUDGET_USD_PER_CHILD` | server | own decision (default 5)          | 4      |
| `SENTRY_DSN`                      | server | sentry.io                         | 9      |
| `POSTHOG_PROJECT_API_KEY`         | server | posthog.com                       | 9      |

## One-command bootstrap

```bash
pnpm install                         # install workspace deps
cp web/.env.example web/.env.local   # fill in values
pnpm db:generate                     # generate the first migration (Module 2+)
supabase db push                     # apply migrations + RLS policies
pnpm dev                             # http://localhost:3000
```

For production:

```bash
vercel link
vercel env pull web/.env.local
pnpm build
vercel --prod
```

## Vercel project settings

- Framework preset: Next.js
- Root directory: `web/`
- Install command: `pnpm install --frozen-lockfile` (override default)
- Build command: `pnpm --filter @bluecare/web build`
- Output: `.next` (default)
- Node version: 22

## Supabase setup checklist

1. Create project, region close to Saudi audience (eu-central-1 or me-south-1).
2. Disable email confirmation in dev only; require it in production.
3. Apply migrations: `supabase db push`.
4. Apply RLS: same migration set picks up `db/rls/policies.sql`.
5. Create a Storage bucket: `symbols` (public read), `voices` (private).
6. Create an admin user manually and set `profiles.role = 'admin'`.

See [`runbook.md`](./runbook.md) for incident-response and on-call procedures.
