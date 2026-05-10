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

### Vercel CLI preview env-add quirk on 51.5.0

**Discovered**: Module 2.A.1 (env wiring).
**Symptom**: Adding an env var to the `preview` environment in non-interactive mode errors with `action_required: git_branch_required` even though the CLI's own help and the JSON-error `next[]` suggestion point at the same invocation that just failed:

```
vercel env add NAME preview --value V --yes
→ {"status":"action_required","reason":"git_branch_required","next":[{
    "command":"vercel env add NAME preview --value <value> --yes",
    "when":"Add to all Preview branches"}]}
```

The CLI's "all preview branches" path is broken in 51.5.0 in non-interactive mode. Production and Development scopes work fine.
**Workaround** (verified): pass an empty string as the third positional arg.

```
vercel env add NAME preview "" --value V --yes      ✓ adds to all preview branches
```

**Why we can't just upgrade**: Vercel CLI 53.3.1 (which seems to fix this) injects `os.hostname()` into the User-Agent header, and this Windows machine's hostname is `الهارون1` (Arabic). HTTP headers must be ASCII so the request fails with `... is not a legal HTTP header value`. Both `os.userInfo().username` and the `USER`/`USERNAME` env vars are ASCII, but `os.hostname()` reads from the Windows API and isn't overridable from userland.
**Next step**: revisit when (a) Vercel CLI 53+ stops embedding the hostname in the UA header, or (b) we move the dev box to a non-Arabic hostname, or (c) we stand up CI-driven Vercel deploys via GitHub Actions instead of local CLI pushes.
**Owner**: Module 9 (DX cleanup).

### Module 2.B — RLS integration suite + 10-flow Playwright matrix deferred

**Discovered**: Module 2.B Iteration 2 scope review.
**Symptom**: The Iteration 2 brief calls for (a) RLS integration tests across the eight Module-2 tables (`users`, `profiles`, `children`, `consent_records`, `audit_log`, `therapist_invites`, `therapist_grants`, `draft_onboarding`) using a real Supabase project, and (b) Playwright E2E for ten critical flows in EN + AR. Neither suite is wired up at end-of-iteration — only the auth E2E from Module 2.A is in CI.
**Why deferred**: Both require a dedicated test Supabase project with seeded fixtures and a Playwright harness that boots a full app server with the new tRPC routes. The wiring fits in Iteration 3 alongside session hardening + cookie scoping changes. Landing it now would balloon this PR past reviewable size — the foundation work (CSRF + recent-auth gates + RLS migration) is already covered by the Module 2.A integration tests at the schema/policy level, so the regression risk of deferring is bounded.
**Workaround**: Manual smoke through the wizard + settings + accept-invite + GDPR endpoints on every commit during this iteration; the auth E2E suite still runs in CI to catch session-cookie regressions.
**Next step**: Module 2.B Iteration 3 — provision a `bluecare-test` Supabase project, port the 10-flow critical-path matrix from `docs/critical-flows.md` into Playwright specs, and add an RLS integration suite that exercises each policy with a service-role + anon-role pair of Supabase clients.
**Owner**: Module 2.B Iteration 3.

### Module 2.B — real ElevenLabs / Azure voice SDK calls deferred

**Discovered**: Module 2.B Iteration 2 voice-step build.
**Symptom**: `/api/voice-preview` and the wizard's voice-selection step return a placeholder WAV (sine-sweep) generated by the mock provider. The `aiGuard` cap is wired and counts mock calls as zero-cost, so per-child preview budgets aren't enforced yet.
**Why deferred**: Module 9 is the dedicated AI-integration window. The mock keeps the wizard flow shippable today and lets the consent-step copy promise voice previews honestly without committing to the SDK shape until pricing + rate-limit posture is finalized.
**Workaround**: The mock provider returns audible audio (440→660Hz sine) so caregivers can complete the wizard end-to-end and the UI looks correct. The "previews remaining" counter is enforced client-side as a stand-in for the server-side cap.
**Next step**: Module 9 — add `web/src/lib/voice/elevenlabs.ts` and `web/src/lib/voice/azure.ts`, wrap both in `aiGuard`, and switch the dispatcher in `web/src/lib/voice/index.ts` based on locale (EN→ElevenLabs, AR→Azure Neural TTS).
**Owner**: Module 9.

### Module 2.B — manual screen-reader pass on /signup, /login, /onboarding/_, /settings/_ deferred

**Discovered**: Module 2.B Iteration 2 a11y review.
**Symptom**: VoiceOver (macOS) and NVDA (Windows) passes haven't been recorded against the new wizard / settings / accept-invite surfaces. axe-core in CI catches the structural violations but human-narrated SR review is still pending.
**Why deferred**: Need a dedicated Mac + a Windows setup with NVDA installed; the iteration laptop has neither. Code-level a11y posture is sound (axe-core green, focus management on every modal, proper aria-\* on PinGate, role="alert" on every error).
**Workaround**: axe-core CI gate + manual keyboard-only walkthrough on every page during iteration. Module 9 a11y audit will fold the SR pass in.
**Next step**: Module 2.B Iteration 3 or Module 9 — record a VoiceOver pass on `/onboarding/welcome` through `/onboarding/review`, then NVDA on the same flow + `/settings/privacy` consent revocation + `/settings/account` deletion.
**Owner**: Module 9 (a11y audit).

## Resolved (last 14 days)

_None yet._
