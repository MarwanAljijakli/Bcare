# Known issues

A running log of things we know about but haven't fixed yet. Each entry has a
clear next-step and an owner-module. Solved entries move to the closeouts list
in `docs/backlog.md`.

## Active

### Module 9 — symbol-audit prompt too literal for AAC conventions

**Discovered**: Phase 9 native-speaker acceptance test (2026-05-12).
**Symptom**: `/admin/symbols-audit` re-ran after the Phase 1 reseed reports
**33 image↔label mismatches** vs the **6** the earlier audit logged. Spot-
checking the new mismatches shows the audit's Claude vision prompt is
judging AAC convention symbols too literally:

- `you / أنت` shown as a pointing finger — flagged "wrong, should be a
  person" — but the pointing-finger IS the universal AAC symbol for
  second-person reference across every commercial AAC product (Proloquo2Go,
  TouchChat, CoughDrop, etc.).
- `grow / ينمو` shown as up/down arrows — flagged "wrong, should be a
  plant growing" — but directional arrows are the standard AAC
  abstraction for change-of-state verbs.
- `house / منزل` shown as a house with a chimney smoking — flagged
  "wrong, should be a plain house" — the smoking-chimney detail is in
  ARASAAC's canonical home pictogram.

These are NOT real data-quality bugs. The audit prompt is the bug —
it doesn't know about AAC iconography conventions and over-flags
abstractions that AAC SLPs (speech-language pathologists) consider
correct and intentional.

**Why deferred**: Refining the audit prompt is Module 9 hardening work
(audit-prompt-v2 with AAC convention awareness, possibly few-shot
exemplars of "this abstraction is OK" patterns). Re-running the audit
against 700+ symbols with a refined prompt also costs Claude API calls
worth measuring against the monthly cap, so it deserves a scheduled
batch run, not an ad-hoc rerun.

**DO NOT** auto-relabel symbols based on the current 33 mismatches. The
correct labels are already in the seed JSON; auto-applying the audit's
"recommended*label*\*" suggestions would actively degrade the symbol set.

**Workaround**: The audit page still ships (UI works, mismatches surface
for review) so caregivers + admins can spot genuine egregious mismatches
manually. The auto-relabel button is intentionally NOT exposed.

**Next step**: Module 9 hardening — refine the audit Claude prompt with
explicit AAC convention guidance ("a pointing finger represents 'you' in
AAC", "abstract icons for state changes are acceptable"), add 5-10
few-shot exemplars of correctly-abstract symbols, then rerun the audit
in batch mode and verify the false-positive rate falls below 5%.

**Owner**: Module 9 hardening.

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

### Module 3 — operator must run ARASAAC seed before /board renders symbol images

**Discovered**: Module 3 build.
**Symptom**: `/board` renders the layout, sentence strip, speak button, category rail, and favorites bar correctly, but the symbol grid is empty until `db/scripts/seed-arasaac.ts` is run against the live Supabase project. The migration `db/migrations/0002_storage_buckets.sql` creates the `symbols-public` + `symbols-private` storage buckets; the seed script then downloads ~40 ARASAAC pictograms (CC BY-NC-SA, public CDN), uploads them to `symbols-public`, and writes the corresponding `public.symbols` rows. Without that step, `board.bootstrap` returns `symbols: []`.
**Why deferred**: The seed script needs network egress to `api.arasaac.org` and the `SUPABASE_SERVICE_ROLE_KEY` — both are operator-side. Running it from CI requires an outbound allow-list + a CI-only env-var which is a Module 9 piece.
**Workaround**: Operator paste of `db/migrations/0002_storage_buckets.sql` in the Supabase SQL editor, then `pnpm tsx db/scripts/seed-arasaac.ts` from the workstation with `.env.local` populated. Idempotent — re-running is safe.
**Next step**: Module 9 hardening — promote the operator-paste workflow to `drizzle-kit migrate`, and add a one-shot CI job that runs the seed against the live project on first deploy of the seed dataset.
**Owner**: Module 3 (operator) → Module 9 (automation).

### Module 3 — full ~2000-symbol ARASAAC corpus + categorization deferred

**Discovered**: Module 3 build.
**Symptom**: The `db/seed/arasaac-core.json` dataset committed in Iteration 2 covers ~40 high-priority bilingual symbols across 7 categories — enough for the wizard's "starter" vocabulary level to render with full board interaction. The master prompt's full ~2000-symbol corpus + category coverage (food, feelings, people, actions, places, numbers, colors, clothing, body, time, common phrases) is not yet in the seed.
**Why deferred**: Sourcing accurate bilingual labels for 2000 symbols is a content task, not an engineering task. The seed script supports any rows the JSON gives it, so growing the dataset is purely a data effort. Module 4 personalization fans the existing 40 across the four vocabulary levels via category mapping, so the gap doesn't block progression.
**Workaround**: Caregivers can upload custom symbols via the Module 6 dashboard (when it ships) and add their own labels for any concept the seed doesn't cover.
**Next step**: Module 9 — engage a translator + an AAC consultant to audit a 1000-symbol bilingual content pass against the 11 categories the master prompt names. Persist as JSON in `db/seed/arasaac-{starter,expanding,conversational,advanced}.json` and rerun the seed script.
**Owner**: Module 9 (content + engineering).

### Module 3 — MediaPipe webcam-gesture mode deferred behind a feature flag

**Discovered**: Module 3 scope review.
**Symptom**: The master prompt called for opt-in webcam-gesture mode using MediaPipe Hands (pinch-select, swipe-navigate, on-device). This is not yet wired — the `Hold-to-speak` (browser SpeechRecognition) modality ships as the second input modality alongside tap, with gesture deferred.
**Why deferred**: MediaPipe Hands is ~6 MB of WASM + model weights; we want to load it from the official CDN behind a per-child opt-in toggle so caregivers who don't enable it don't pay the bundle cost. The toggle UX is small but the right home for it is the Module 6 dashboard (sensory profile editor), not a pre-wizard setup. Time-boxed per the master prompt — explicit authorization to ship behind a feature flag.
**Workaround**: Tap modality + browser SpeechRecognition cover the two most-used input paths; gesture is a quality-of-life feature for non-verbal children with reduced touch dexterity. Document on /accessibility once it lands.
**Next step**: Module 4/6 — add `child.gestureModeEnabled` to the sensory profile, lazy-load `@mediapipe/hands` from `https://cdn.jsdelivr.net/npm/@mediapipe/hands/...` only when the toggle is on, and wire pinch + swipe to the same select / nav handlers the tap modality uses.
**Owner**: Module 4 / Module 6.

### Module 3 — service-worker offline cache deferred behind a feature flag

**Discovered**: Module 3 build.
**Symptom**: The board renders fine when online but does not yet survive a network drop — there is no service worker caching the symbol image bytes + UI shell, and no IndexedDB queue for input/output events that fail while offline.
**Why deferred**: Per the master prompt's explicit "time-box service-worker offline tests; if flaky, ship the SW behind a one-line feature flag and document in known-issues" instruction. The feature is genuinely valuable but its testing surface (intermittent network, race conditions on the queue, cache invalidation when the symbol set updates) is large enough to threaten the Module 3 CHECKPOINT.
**Workaround**: The board functions correctly online; recordInput/recordOutput tRPC mutations retry via react-query default behaviour on transient failures.
**Next step**: Module 9 hardening — register a Workbox-backed SW that pre-caches the symbol image set (the bootstrap response gives us all the public storage paths up front), queues failed mutations via Background Sync, and replays them on `online`. Gate behind `?sw=on` until the test matrix is clean.
**Owner**: Module 9.

### Module 3 — IndexedDB TTS audio cache deferred

**Discovered**: Module 3 build.
**Symptom**: Repeated phrases ("more please", "I want water") regenerate browser-TTS audio every time. The master prompt called for caching the synthesized audio in IndexedDB keyed by `(text, voice, lang)` so subsequent reads are instant.
**Why deferred**: The browser SpeechSynthesis API doesn't expose the synthesized audio buffer — there's no public hook to capture the bytes mid-render. Capturing it requires routing through `MediaRecorder` on a hidden `AudioContext` graph, which (a) requires a user gesture per recording session, (b) is browser-inconsistent, and (c) won't survive the Module 9 swap to ElevenLabs/Azure provider voices anyway.
**Workaround**: The sentence-strip tokens are themselves cached client-side as React state; subsequent speaks of the same token are sub-100ms because SpeechSynthesis itself is fast for short utterances.
**Next step**: Module 9 — when ElevenLabs/Azure providers ship behind the feature flag, those return raw audio buffers we can hash + cache in IndexedDB. The browser-native fallback path stays uncached.
**Owner**: Module 9.

### Module 9 — public.users has no FK to auth.users; deletes don't cascade

**Discovered**: Module 3.1 end-to-end verification.
**Symptom**: `db/scripts/verify-end-to-end.ts` revealed that calling
`supabase.auth.admin.deleteUser(id)` removes the `auth.users` row but leaves
the corresponding `public.users` row + every downstream child / profile /
consent_records row. Our schema has only an INSERT-time mirror trigger
(`handle_new_user`), no DELETE-time linkage.
**Why deferred**: not load-bearing today — the GDPR `account.deleteAll`
mutation soft-deletes via `users.deleted_at` and a Module 9 cron purges
30 days later, doing the cascade explicitly. The admin-delete path is only
exercised by the e2e test today.
**Workaround**: `db/scripts/cleanup-e2e.ts` (and the verify script's
teardown) deletes dependents in FK-aware order before the auth row.
**Next step**: Module 9 — add `references auth.users(id) on delete cascade`
to `public.users.id` so admin-delete cascades naturally; or pair the
`handle_new_user` trigger with `handle_deleted_user` that wipes the
mirror.
**Owner**: Module 9.

## Resolved (last 14 days)

### 2026-05-10 — Module 2.A.1.fix.3: wizard crashed on /en/onboarding/welcome (RESOLVED)

**Symptom**: Pasting an admin-generated magic-link in incognito landed
the user on `https://bcare-ten.vercel.app/en/onboarding/welcome#access_token=…`
with the page tab title set correctly ("You're in. — BlueCare") but the
body showing the Next.js error boundary ("Something went wrong / Please
try again"). HTTP 500.

**Root cause**: `web/app/[locale]/(auth)/onboarding/[step]/page.tsx` is
a Server Component that imported `WIZARD_STEPS` from
`web/src/components/onboarding/wizard-shell.tsx` — a `'use client'`
module. Next.js wraps client-module values with a server-side Proxy that
explicitly forbids method calls. The line `WIZARD_STEPS.includes(step as
WizardStep)` threw at runtime:

```
Error: Attempted to call includes() from the server but includes is
on the client. It's not possible to invoke a client function from the
server, it can only be rendered as a Component or passed to props of a
Client Component.
  at Proxy.includes (next-server/app-page.runtime.prod.js)
  at S (web/.next/server/app/[locale]/(auth)/onboarding/[step]/page.js:1:28209)
```

**Why prior CHECKPOINTs missed it**:

1. The build doesn't statically know `Array.includes` will fail on the
   Proxy — it's a runtime check, not a type/compile-time one.
2. All Module-2.B verification probes hit `/onboarding` (the index,
   which redirects without ever calling the proxy method) or skipped
   directly to `/dashboard`. None hit `/[step]` server-side with input
   that exercised the wizard step list.
3. Module 2.A.1.fix.2's verification used
   `supabase.auth.admin.generateLink({type:'magiclink', ...})` which
   returns an IMPLICIT-flow URL (`#access_token=...` fragment). The
   server doesn't see fragments. Real signups use PKCE (`?code=...`
   routed through `/auth/callback`), which is the path that actually
   triggers the server component crash. The two flows took different
   code paths and the admin-shortcut path silently bypassed the bug.

**Fix**:

1. Extracted `WIZARD_STEPS` + `type WizardStep` into a new non-client
   module `web/src/components/onboarding/wizard-steps.ts`. The server
   component imports from there directly.
2. `wizard-shell.tsx` (still `'use client'`) re-exports the same symbols
   so existing client-side imports keep working without churn.
3. Replaced the entire `admin.generateLink` fallback in
   `db/scripts/send-test-magic-link.ts` with a direct POST against the
   live `/api/auth/login` (or `/api/auth/signup` if the user doesn't
   exist) — same code path real signups use, so the test exercises the
   PKCE flow end-to-end instead of an implicit-flow shortcut.
4. `docs/runbook.md` § "Verifying production signup works" Step 5
   rewritten: "the only acceptance test is a real human clicking a real
   email link from the real production signup flow." Curl probes and
   admin-generated links are formally insufficient.

**Process change**: every CHECKPOINT must trigger the email through the
production `/api/auth/{login,signup}` endpoint (via the test script or a
real form submit), wait for the email to land in a real inbox, click it
in a real browser, and land on a working `/en/onboarding/welcome` (no
404, no error boundary, no auth bounce) before the CHECKPOINT can be
declared done.

### 2026-05-10 — Module 2.A.1.fix.2: magic-link emails 404'd at /en/auth/callback (RESOLVED)

**Symptom**: Real user signed up, received the magic-link email, clicked
it, browser landed on `https://bcare-ten.vercel.app/en/auth/callback?code=
...&next=%2Fen%2Fonboarding` — 404 "This page could not be found."

**Root cause**: The `/auth/callback` route lives at `web/app/auth/callback/
route.ts` (NOT inside the `[locale]` segment) — Supabase magic-link emails
carry an absolute redirect URL with no locale, and the route handler is
locale-agnostic. The next-intl middleware in `web/middleware.ts` had a
matcher `'/((?!api|_next|_vercel|.*\\..*).*)'` that excluded `/api`,
`/_next`, `/_vercel`, and dot-files — but **NOT `/auth`**. So an incoming
`GET /auth/callback?...` was matched by the middleware, which (with
`localePrefix: 'always'`) rewrote it to `/en/auth/callback?...`. There's
no `[locale]/auth/callback` route — Next.js returned 404.

The signup route handler had been building the redirect URL correctly all
along (`${baseUrl}/auth/callback?next=/${locale}/onboarding` — locale-free
path, locale in `next` query). Same for the login route. The bug was the
middleware rewriting the user's INCOMING click, not the OUTGOING email URL.

**Why earlier probes didn't catch it**: `/api/health/auth` and
`signup-real.spec.ts` both stopped at "the signup endpoint returns 200" and
"a magic-link email is queued." Neither followed the email URL. The
Module 2.A.1.fix verification chain ended one step too soon.

**Fix**:

1. `web/middleware.ts`: matcher updated to `'/((?!api|_next|_vercel|auth|
.*\\..*).*)'` — adds `auth` to the exclusion list. Locale-agnostic
   routes under `/auth/*` now resolve directly without intl rewriting.
2. `/api/health/auth` extended to call `supabase.auth.admin.generateLink({
type:'magiclink', ...})` against a reserved health-check email and
   assert the action_link does NOT contain `/(en|ar)/auth/callback` and
   DOES contain `/auth/callback`. Returns `magicLinkOk:true` on success;
   503 with `magicLinkReason` on regression. The personalization cron's
   drift detector now catches this regression automatically.
3. `signup-real.spec.ts` asserts `magicLinkOk:true` in the health probe
   response — fails loudly if a future config change brings the bug back.
4. `docs/runbook.md` § "Verifying production signup works" gains a new
   Step 4 (magic-link URL probe) and an explicit Step 5 (real-browser
   click required at every CHECKPOINT). Curl-only verification is now
   formally insufficient.

**Process change**: every CHECKPOINT must now include a real-human magic-
link click before declaring done. The user clicks the link in their
inbox, lands on `/en/onboarding`, and confirms in chat. CHECKPOINT proceeds
only after that handshake.

### 2026-05-10 — Module 2.A.1.fix: production signup returned "Database error saving new user" (RESOLVED)

**Symptom**: Real users hitting https://bcare-ten.vercel.app/en/signup with a
valid form payload (role=parent, full name, email, consent checked) saw "We
couldn't reach the server. Please try again in a moment." on the client.
The server was returning HTTP 500 with body
`{"type":"https://bluecare.app/errors/auth_failed","title":"Signup failed",
"status":500,"detail":"Database error saving new user","instance":"/api/auth/signup"}`.
The Module 4 CHECKPOINT probes had reported all green — but they only
exercised mock/empty-body paths, not a real submit.

**Root cause**: Postgres fires multiple AFTER triggers on the same event in
**alphabetical order by trigger name**. Two triggers were attached to
`auth.users` after INSERT:

- `on_auth_user_consent_signup` → `copy_consent_to_records()` (consent fanout)
- `on_auth_user_created` → `handle_new_user()` (mirror to `public.users`)

`on_auth_user_consent_signup` < `on_auth_user_created` alphabetically, so
the consent trigger ran first. It tried to
`INSERT INTO public.consent_records (granted_by_id, ...) VALUES (new.id, ...)`,
but the FK `consent_records.granted_by_id → public.users.id` referenced a row
that didn't exist yet (the mirror trigger hadn't run). The FK violation
rolled back the entire signup transaction with the standard
"Database error saving new user" message Supabase Auth surfaces for any
trigger failure.

**Why earlier verify-end-to-end.ts passed**: that script created its test
user with `user_metadata.consent.dataProcessing` (not `consent.granted`).
The consent trigger's guard `(consent_data->>'granted')::boolean is distinct
from true` evaluated true (NULL is distinct from true), so the trigger
short-circuited before hitting the FK. The real signup payload sets
`consent.granted = true`, which exercised the broken path.

**Secondary issue caught during the fix**: Supabase Auth `site_url` was
still the dashboard default `http://localhost:3000` and `uri_allow_list` was
empty. Even after the trigger fix, magic-link emails would have pointed at
localhost. Both were patched via the Management API to:

- `site_url = https://bcare-ten.vercel.app`
- `uri_allow_list = https://bcare-ten.vercel.app/**,http://localhost:3000/**`

**Fix**:

1. Combined the two trigger functions into one `handle_new_auth_user()` that
   mirrors `public.users` first, then handles consent fanout, both wrapped
   in EXCEPTION blocks so a future bug in either side can never block a real
   signup. Single trigger `on_auth_user_signup` replaces the two old triggers.
2. Migration `db/migrations/0004_fix_auth_user_trigger.sql` drops the old
   `on_auth_user_created` + `on_auth_user_consent_signup` triggers and
   `handle_new_user` + `copy_consent_to_records` functions. Idempotent.
3. Patched Supabase Auth config (site_url + uri_allow_list).

**Verification on live deploy**:

- `POST /api/auth/signup` with a real payload now returns
  `{"ok":true,"mode":"real","method":"magic-link"}` (status 200).
- A row appears in `auth.users` with the correct role/locale/consent metadata.
- The `handle_new_auth_user` trigger mirrors to `public.users`.
- `consent_records` gets a `data_processing` granted=true row keyed to the
  caregiver's `granted_by_id`.

**Regression net** (so this never silently breaks again):

- New endpoint `GET /api/health/auth` exercises a real Supabase call
  (`auth.admin.listUsers({page:1,perPage:1})`) and asserts the project ref
  matches what the Vercel env var points at. Returns
  `{ok:true,supabaseProject:"ikaaxfhenfbpfjqboixk"}` on success, 503 on
  drift.
- New e2e `web/e2e/signup-real.spec.ts` (tagged @real-network, opt-in via
  `pnpm test:e2e:real`) submits a valid throwaway-email signup against the
  LIVE deploy and asserts 2xx + JSON success shape + the expected project
  ref.
- The Module 4 personalization cron at `/api/cron/personalization` now
  pre-flights `/api/health/auth` before doing any work and audit-logs a
  `config_drift_detected` action if the project ref ever differs from the
  expected `ikaaxfhenfbpfjqboixk`.

**Process change**: every CHECKPOINT going forward MUST include a real
curl-against-live signup probe. The "render returned 200" + "zod rejects
empty body returns 400" pair of probes used through Module 4 CHECKPOINT was
demonstrably insufficient. See `docs/runbook.md` § "Verifying production
signup works" for the canonical probe sequence.

### 2026-05-10 — Module 3.1 schema-drift incident (RESOLVED)

**Symptom**: The Bcare Supabase project (`ikaaxfhenfbpfjqboixk`, alawimasa08
org, Sydney region) had ~28 leftover tables from an unrelated prior
experiment of the project owner's (real-estate / financial-modeling SaaS).
A previous attempt to paste BlueCare's SQL appeared to succeed but actually
no-op'd because of a `profiles` table-name collision; the rest rolled back
inside a transaction. Result: every `public.*` write from BlueCare's tRPC
procedures and onboarding finalize would have failed silently against
this project for the entirety of Modules 2.A → 3.

**Resolution** (project owner + agent, 2026-05-10):

1. Owner wiped public schema and applied the BlueCare schema fresh via the
   Supabase CLI (`supabase db push` against migrations they staged).
2. Agent built an idempotent migration runner
   (`db/scripts/apply-migrations.ts`) using the Management API + a
   personal access token, plus a permanent verifier
   (`db/scripts/verify-schema.ts`) and an end-to-end data-path test
   (`db/scripts/verify-end-to-end.ts`).
3. Re-created the `symbols-public` and `symbols-private` storage buckets
   via the admin Storage API.
4. Seeded 40 ARASAAC pictograms (CC BY-NC-SA) into `symbols-public` and
   the `symbols` table; verified all 40 image URLs return 200 image/png
   from the public bucket.
5. End-to-end verification: created a service-role test caregiver,
   inserted profile + child + consent_records, confirmed the
   `auth.users → public.users` mirror trigger fires, confirmed
   `board.bootstrap` returns 40 symbols, then cleaned up cleanly.
6. Backup of any pre-existing experiment data: 0 leftover tables found
   on the live project at the moment the agent started Phase 1 — the
   owner's reset was already complete by that point. The
   `bcare-old-experiment-backup/` directory is empty (gitignored).
7. Updated `docs/runbook.md` to make the migration runner the canonical
   path; deprecated the operator-paste workflow.
8. Pre-existing schema gap (no FK from `public.users` to `auth.users`)
   surfaced during e2e teardown — logged separately above as a Module 9
   item, not a regression from the remediation.
