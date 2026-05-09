# Known issues

A running log of things we know about but haven't fixed yet. Each entry has a
clear next-step and an owner-module. Solved entries move to the closeouts list
in `docs/backlog.md`.

## Active

### local production server returns 500 on Windows

**Discovered**: Module 1 quality gate.
**Symptom**: `pnpm exec next start -p 3000` boots successfully (`✓ Ready in 329ms`) but every route — `/en`, `/ar`, `/icon.svg`, `/sitemap.xml`, `/api/health` — responds with HTTP 500 and a one-line `Internal Server Error` body. No stack trace appears in stdout.
**Reproduction**: From repo root on Windows, `pnpm build` (clean exit) → `cd web && pnpm exec next start -p 3000` → `curl http://localhost:3000/en` returns 500.
**Not affected**: `pnpm dev` runs fine and returns 200 on the same routes. CI on Ubuntu (GitHub Actions) builds + serves cleanly. Vercel production deploy serves cleanly.
**What we tried**:

- Killing stray node processes on port 3000 / 3001 — no change.
- Re-running build after `pnpm clean` — no change.
- Checked for stale `.next/` cache from earlier Turbopack experiments — clean state.
  **Workaround**: Use `pnpm dev` for local manual testing. CI + Vercel are the source of truth for production-build correctness.
  **Next step**: Time-box another 30 min in Module 2.B; if not trivially resolvable, escalate to a Sentry dashboard bug ticket once observability lands in Module 9.
  **Owner**: Module 2.B.

### Module 2.A — consent_records insert deferred to 2.B

**Discovered**: Module 2.A while wiring `/api/auth/signup`.
**Symptom**: At signup, the consent grant is captured into `auth.users.raw_user_meta_data.consent` (hash + version + timestamp) but **no row is written to `public.consent_records`** yet. The user's consent is recorded against their auth identity but not in the relational table that the GDPR/PDPL endpoints will read in Module 2.B.
**Why deferred**: Anonymous insert into `public.consent_records` requires either (a) a SECURITY-DEFINER trigger that fires on `auth.users` insert, or (b) the SERVICE_ROLE_KEY to bypass RLS for an unauthenticated client. Both paths are Module 2.B work — the service role key wasn't yet handshaked at Module 2.A start, and the trigger needs the migration to be applied first.
**Workaround**: The data needed to populate `consent_records` is preserved in `auth.users.raw_user_meta_data`. Module 2.B's first task is a one-shot backfill that walks `auth.users`, reads the `consent` blob, and inserts the corresponding rows.
**Next step**: Module 2.B — apply the consent-records-on-signup trigger as part of the migration set, plus a backfill script for any pre-trigger signups.
**Owner**: Module 2.B.

### Module 2.A — apple-touch PNG still served as SVG

Already tracked in `docs/backlog.md` (Module 9 closeout). Mentioned here for completeness; no new action required.

## Resolved (last 14 days)

_None yet._
