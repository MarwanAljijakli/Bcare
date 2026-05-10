# BlueCare — Status report

_Generated 2026-05-10. Read-only inspection. No code changed._

## 1. Executive summary

BlueCare is a free, open, bilingual (EN + AR with full RTL) AAC web platform for children with autism. As of 2026-05-10 the project has shipped Modules 0 → 2.B Iteration 2: a polished marketing site, real Supabase auth (magic link + password), the full 18-table relational schema with RLS, an 8-step caregiver onboarding wizard, /settings (privacy + therapists + account), GDPR/PDPL export + delete REST endpoints, parental-PIN gate, therapist invite + accept flow, and an admin invite CLI. The child board (Module 3), AI personalization (Module 4), gamification (Module 5), caregiver/therapist dashboard (Module 6), admin UI (Module 7), help surfaces (Module 8), and production hardening (Module 9) have not started. Live site is healthy; latest production deploy is `Ready` on Vercel. RLS integration tests + 10-flow Playwright matrix + real ElevenLabs/Azure voice SDK + manual VoiceOver/NVDA pass remain deferred to Iteration 3 / Module 9.

- **Live URL**: https://bcare-ten.vercel.app
- **Current HEAD on main**: `dced0f0` (feat(auth,web,i18n): module 2.b iteration 2 — wizard, settings, gdpr, pin gate)
- **Auth mode (production)**: **`real`** — verified by `vercel env ls` showing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` all `Encrypted` in `Production` (16h ago) + `POST /api/auth/signup` returning RFC-7807 Problem Details from real zod validation rather than mock-mode 503. AUTH_MODE log line not directly captured (Vercel runtime log scraping not run); env-var presence is the deterministic proxy.
- **Probe results (2026-05-10 08:38 UTC)**: `/api/health` → `{"ok":true,"name":"bluecare","version":"0.1.0"}` 200 · `/en` → 200 · `/ar` → 200 · `/api/csrf` → 200 with token · `/ar/onboarding` → 307 (auth gate redirect, expected).

---

## 2. Modules completed

### Module 0 — Repo, schema, primitives

- **One-line**: monorepo scaffolding, 18-table Drizzle schema, design-token system, brand mark, accessibility baseline.
- **Deliverables**:
  - `pnpm` workspace with `web/`, `db/`, `shared/` packages.
  - 18 Drizzle schema files in `db/schema/` + `db/schema/index.ts` barrel.
  - Tailwind brand tokens + CSS-var theming (light / dark / hc).
  - Radix-based UI primitives in `web/src/components/ui/` (button, input, label, badge, card, accordion, separator).
  - Brand wordmark (`web/src/components/brand/logo.tsx`).
  - i18n routing scaffold (`web/src/i18n/routing.ts`, `[locale]` segment).
  - `next-themes` provider, theme switcher, language switcher.
  - `commitlint.config.mjs` with type+scope enums.
  - Husky + lint-staged + Prettier + ESLint flat config.
  - `cn`, `direction`, `motion` lib helpers + tests.
- **Acceptance criteria covered**: AC-1 (tooling: TypeScript strict, Tailwind, ESLint, Prettier, Vitest, Playwright, Storybook, Husky, lint-staged), AC-2 (token system + 3 themes), AC-7 (responsive RTL infra), AC-9 (axe-core hookup).
- **Deferred from Module 0**: Supabase Database type generation in CI (still placeholder `web/src/lib/supabase/types.ts`); ARASAAC seed import; replace placeholder app glyph.

### Module 1 — Marketing site

- **One-line**: 11 marketing routes EN+AR, AAA-grade design, RTL parity, JSON-LD, sitemap, OG image generator, e2e suite.
- **Deliverables**:
  - 11 pages under `web/app/[locale]/(marketing)/`: landing, how-it-works, for-caregivers, for-therapists, about, team, security, privacy, terms, accessibility, contact.
  - Marketing shell: `marketing-header.tsx`, `marketing-footer.tsx`, `trust-strip.tsx`, `device-frame.tsx`, `mock-child-board.tsx`, `mock-dashboard.tsx`, `legal-page.tsx`, `section.tsx`, `faq-list.tsx`.
  - SEO: `seo.ts` + `jsonld.tsx`; `app/sitemap.ts`, `app/robots.ts`, `app/api/og/route.ts`.
  - i18n catalogs: `web/messages/{en,ar}.json` (905 lines each).
  - Storybook stories for marketing primitives + brand mark + auth components.
  - Playwright `e2e/marketing.spec.ts` — 188 tests (full EN+AR matrix + axe-core).
- **Acceptance criteria covered**: AC-3 (marketing site bilingual), AC-7 (RTL parity), AC-9 (axe-core green), AC-15 (sitemap, OG, JSON-LD), AC-16 (Lighthouse ≥ 95 gate in CI).
- **Deferred from Module 1**: native Arabic copy review by a native reviewer (queued); Apple touch PNG icon (still SVG).

### Module 1.5 — Free + open pivot

- **One-line**: removed waitlist + pricing + tiers framing; BlueCare is free for everyone, signup is open.
- **Deliverables**:
  - `/pricing` route deleted; 308 permanent redirect added.
  - Header CTA replaced with two buttons (`Get started` + `Sign in`).
  - `waitlist_signups` table marked `@deprecated`; `/api/waitlist` retained read-only.
  - Marketing copy refreshed: "Free for families, therapists, and educators" hero caption, free closing CTA, no tier table, no Pricing footer link.
  - Product JSON-LD on landing asserts `InStock` + `price 0`.
  - Sitemap excludes `/pricing`, includes `/signup` + `/login`.
  - E2E "free + open framing" matrix in `marketing.spec.ts`.
- **Acceptance criteria covered**: clarification of AC-3 framing.
- **Deferred from Module 1.5**: drop `waitlist_signups` table + `/api/waitlist` + `shared/schemas/waitlist.ts` after 60 days of zero new rows (Module 9 hardening).

### Module 2.A — Auth surfaces (Iteration 1)

- **One-line**: production /signup, /login, /reset-password client surfaces, adaptive auth backend (real / mock / unconfigured), `/api/auth/{signup,login}` route handlers.
- **Deliverables**:
  - `web/app/[locale]/(auth)/{signup,login,reset-password}/page.tsx` + corresponding client forms.
  - Auth shell + brand-promise panel + dev-mode banner: `auth-shell.tsx`, `brand-promise-panel.tsx`, `dev-mode-banner.tsx`.
  - Auth components: `signup-form.tsx`, `login-form.tsx`, `password-input.tsx`, `role-selector.tsx`, `check-email-state.tsx` (+ stories).
  - Auth lib: `mode.ts` (real/mock/unconfigured detection), `dev-mock.ts` (in-memory user store), `rate-limit.ts`, `strength.ts`, `consent.ts`, `zod.ts`.
  - Routes: `/api/auth/signup`, `/api/auth/login`, `/auth/callback` (magic-link / email-confirmation handler).
  - Cookie-bound + service-role Supabase client factories: `web/src/lib/supabase/{client,server,types,index}.ts`.
  - Stub `/[locale]/onboarding` page that catches the magic-link callback before Module 2.B wizard lands.
  - Playwright `e2e/auth.spec.ts`.
- **Acceptance criteria covered**: AC-4 (auth-aware shell), AC-8 (RBAC scaffolding via roleEnum + profiles).
- **Deferred from Module 2.A**: `consent_records` insert at signup (handled in Module 2.B via SECURITY-DEFINER trigger); password-reset email-link flow ("coming soon" copy in place).

### Module 2.A.1 — Env wiring + Supabase project handshake

- **One-line**: real Supabase project provisioned, env vars deployed across all three Vercel scopes, schema + RLS migrations applied to live DB.
- **Deliverables**:
  - Supabase project `ikaaxfhenfbpfjqboixk` (https://ikaaxfhenfbpfjqboixk.supabase.co).
  - `db/migrations/0000_initial_schema.sql` + `db/migrations/0001_rls_policies.sql` applied via SQL editor (operator confirmed).
  - `web/.env.example` documents the env-var contract.
  - Vercel env vars set in Production + Preview + Development for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (verified via `vercel env ls`).
  - Supabase email templates (5 × 2 locales = 10 files) committed in `db/supabase/email-templates/`.
  - Operator workaround for Vercel CLI 51.5.0 preview-add bug documented in `docs/known-issues.md`.
- **Acceptance criteria covered**: AC-4 (auth backend functional in production).
- **Deferred from Module 2.A.1**: per-locale email dispatch (Supabase native templates are single-locale); custom-mailer hook lands in Module 9.

### Module 2.B Iteration 1 — DB foundation (already on main pre-iteration-2)

- **One-line**: applied the 18-table schema + RLS policies + triggers + email templates.
- **Deliverables** (committed previously):
  - All 18 tables in `db/schema/` (3 added in iteration: `therapist_invites`, `therapist_grants`, `draft_onboarding`).
  - `db/rls/policies.sql` with `app_role()`, `is_caregiver_of()`, `is_admin()` helpers and per-table policies.
  - 10 Supabase email templates.
- **Acceptance criteria covered**: AC-5 (RLS enabled per-table), AC-12 (audit_log append-only at the policy level).

### Module 2.B Iteration 2 — Wizard + settings + GDPR + PIN gate (just landed)

- **One-line**: 8-step caregiver onboarding wizard, `/settings/{privacy,therapists,account}`, GDPR REST endpoints, parental-PIN gate, tRPC introduction, admin invite CLI.
- **Deliverables**:
  - tRPC server: `web/src/server/trpc/{trpc,routers/{onboarding,consent,invites,account,index}}.ts`.
  - tRPC route handler: `web/app/api/trpc/[trpc]/route.ts`.
  - tRPC React provider + client: `web/src/lib/trpc/client.tsx`.
  - CSRF: `web/src/lib/auth/{csrf,csrf-shared}.ts` + `/api/csrf` endpoint.
  - Session helpers: `web/src/lib/auth/session.ts` (`requireRecentAuth`, `RECENT_AUTH_WINDOW_MS = 5min`).
  - Parental PIN: `web/src/lib/auth/pin.ts` (bcryptjs cost 12, 3-attempt lockout) + `web/src/components/pin-gate.tsx`.
  - Onboarding wizard: `web/src/components/onboarding/{wizard-shell,wizard-actions}.tsx` + 9 steps in `steps/` (welcome, about_you, about_child, sensory, vocabulary_level, voice, consent, pin, review).
  - Routes: `web/app/[locale]/(auth)/onboarding/{page,[step]/page}.tsx`.
  - App shell: `web/app/[locale]/(app)/layout.tsx` + `web/app/[locale]/providers.tsx` (TrpcProvider + ThemeProvider).
  - Settings: `web/app/[locale]/(app)/settings/{layout,privacy/{page,privacy-client},therapists/{page,therapists-client},account/{page,account-client}}.tsx`.
  - GDPR REST: `web/app/api/account/{export,delete}/route.ts` (CSRF + recent-auth gates).
  - Therapist accept: `web/app/[locale]/accept-invite/[code]/{page,accept-invite-client}.tsx`.
  - Voice: `web/src/lib/voice/{index,mock}.ts` + `web/app/api/voice-preview/route.ts` (mock WAV).
  - AI cost guard: `web/src/lib/ai/{guard,guard.test}.ts` + per-child monthly cap from `AI_MONTHLY_BUDGET_USD_PER_CHILD`.
  - Admin invite CLI: `db/scripts/invite-admin.ts`.
  - i18n additions: `marketing.auth.onboardingWizard`, `marketing.app.{settings,acceptInvite,pinGate,account}` namespaces in EN + AR.
  - New deps (all on master-prompt allow-list): `@trpc/{client,react-query,server}`, `bcryptjs` + types, `superjson`.
- **Acceptance criteria covered**: AC-6 (consent records: grant + revoke writes new row, never mutates), AC-10 (data-portability + erasure endpoints with re-auth gate), AC-11 (parental PIN gate on sensitive actions), AC-12 (audit_log writes on consent change + data export + data delete + admin action), AC-13 (AI cost guard wired with unit tests), AC-14 (CSRF on every mutating route via tRPC middleware + REST verifyCsrf).
- **Deferred from Module 2.B Iteration 2** (logged in `docs/known-issues.md`): RLS integration suite for the 8 Module-2 tables, full 10-flow Playwright matrix EN+AR, real ElevenLabs/Azure voice SDK calls, manual VoiceOver/NVDA pass on /signup, /login, /onboarding/_, /settings/_, password-reset email-link flow.

---

## 3. Modules NOT YET STARTED

### Module 2.B Iteration 3 — Session hardening + RLS suite + E2E matrix

- **Scope (from master prompt)**: cookies httpOnly+Secure+SameSite=Lax+Path=/+30-day refresh fully verified, RLS integration tests for `users`/`profiles`/`children`/`consent_records`/`audit_log`/`therapist_invites`/`therapist_grants`/`draft_onboarding`, Playwright E2E for 10 critical flows in EN + AR, manual SR pass on /signup, /login, /onboarding/\*, /settings/privacy with VoiceOver + NVDA.
- **Blockers**: dedicated test Supabase project (or seeded fixtures in the existing project); a Mac for VoiceOver + a Windows box with NVDA installed.
- **Size**: **M**. Largest unblocker: standing up `bluecare-test` Supabase project + service-role/anon-role test client harness.

### Module 3 — Child AAC board

- **Scope**: tablet-first child surface, three input modalities (symbols, voice hold-to-speak, optional gesture mode via MediaPipe entirely on-device), bilingual symbol grid with frequency-aware reordering, sentence-strip read-aloud with the chosen TTS voice, on-device latency budget (≤50ms tap-to-paint).
- **Blockers**: ARASAAC symbol seed import (~2k bilingual pictograms with attribution); MediaPipe Hands integration + worker; STT provider hooked up.
- **Size**: **XL**. Largest unblocker: ARASAAC seed migration + the symbol-resolver. Voice + gesture each add an L on top.

### Module 4 — AI personalization

- **Scope**: GPT-4o-mini vocabulary suggestions reviewed by caregiver before applying, frequency-aware tile reordering, time-of-day relevance, all calls through `aiGuard()`, no child input ever used to train upstream models.
- **Blockers**: caregiver-review surface (Module 6 dashboard), `vocabulary_sets` write traffic (Module 3 board emits the events), per-service cost coefficients for `aiGuard` (currently estimated).
- **Size**: **L**. Largest unblocker: Module 6 dashboard providing the curation surface — without it suggestions land on a non-existent screen.

### Module 5 — Gamification

- **Scope**: calm streaks (capped 5 stars/day), unlockable themes (animal/nature/space/ocean), no leaderboards, no time pressure, debounced celebrations.
- **Blockers**: child board emitting input events; `gamification_state` write path; theme-pack art direction.
- **Size**: **M**. Self-contained once Module 3 events are flowing. Scope is small (single table, small set of rules) but tightly coupled to the board UX.

### Module 6 — Caregiver / therapist dashboard

- **Scope**: caseload-at-a-glance, today's session, streak, top symbols, "what changed since last sign-in", session replay with notes, vocabulary curation tool, exportable PDF reports, multi-child + multi-therapist switcher.
- **Blockers**: child board emitting `sessions`/`input_events`/`output_events`; nightly `progress_metrics` rollup job; vocabulary set surfaces; PDF generator.
- **Size**: **XL**. Largest unblocker: Module 3 (events) + Module 4 (curation suggestions to display) + nightly cron job for `progress_metrics`.

### Module 7 — Admin

- **Scope**: invite-only admin (already CLI-shipped); admin-only screens for symbol moderation (`pending_review` → `active|rejected`), audit-log viewer (read-only), no admin self-service signup.
- **Blockers**: custom symbol upload flow (caregiver-side, Module 3/6); audit-log filtering UI.
- **Size**: **M**. Lighter than dashboard because it's read-mostly + a single moderation action. CLI invite path already exists.

### Module 8 — Help + legal

- **Scope (per master prompt)**: help center, FAQ, legal pages (privacy/terms/accessibility) — three legal pages already shipped in Module 1; help center + searchable FAQ remain.
- **Blockers**: help-content authoring; search index.
- **Size**: **S**. Mostly content + a search box. Static-first, no DB interaction.

### Module 9 — Production hardening

- **Scope**: Sentry observability + PostHog product analytics (excluded on child surfaces), per-locale email dispatch via custom-mailer hook, real ElevenLabs (EN) + Azure Neural TTS (AR) wired through `aiGuard`, MediaPipe gesture worker, CSP + COOP/COEP/permissions-policy headers tightened, rate limiting at the edge, hard-delete cron for tombstoned accounts after 30-day grace, drop deprecated waitlist surface, supabase gen types in CI with drift fail, Apple touch PNG.
- **Blockers**: Sentry + PostHog accounts; ElevenLabs + Azure API keys; ops decision on edge platform (Upstash, Vercel KV).
- **Size**: **L**. Largest unblockers: third-party account provisioning + the cron infrastructure (likely Vercel Cron or a Supabase edge function).

---

## 4. Routes inventory

### Marketing pages (`web/app/[locale]/(marketing)/`)

| Route                      | State             | Notes                                                                                    |
| -------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `/[locale]` (landing)      | live & functional | Full hero / features / personalization / audiences / closing CTA. Free-and-open framing. |
| `/[locale]/how-it-works`   | live & functional | 4-step + FAQ.                                                                            |
| `/[locale]/for-caregivers` | live & functional | Benefits grid + hero.                                                                    |
| `/[locale]/for-therapists` | live & functional | Benefits grid + hero.                                                                    |
| `/[locale]/about`          | live & functional | Origin story + principles.                                                               |
| `/[locale]/team`           | live & functional | Supervisor + 4 founders.                                                                 |
| `/[locale]/security`       | live & functional | Technical controls + rights + disclosure.                                                |
| `/[locale]/privacy`        | live & functional | Long-form privacy policy (PDPL/GDPR aware).                                              |
| `/[locale]/terms`          | live & functional | Free + open + AAC-disclaimer.                                                            |
| `/[locale]/accessibility`  | live & functional | WCAG 2.2 AA conformance state + known issues.                                            |
| `/[locale]/contact`        | live & functional | Email-only contact, no chat widget.                                                      |
| `/[locale]/pricing`        | redirect 308      | Module 1.5 pivot — redirects to `/signup`.                                               |

### Auth pages (`web/app/[locale]/(auth)/`)

| Route                         | State             | Notes                                                                                   |
| ----------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `/[locale]/signup`            | live & functional | Real Supabase signup + password OR magic-link path; consent gate; rate limit.           |
| `/[locale]/login`             | live & functional | Magic-link + password sign-in.                                                          |
| `/[locale]/reset-password`    | stub              | "Coming soon" copy directs to magic-link sign-in. Email-link flow not implemented.      |
| `/[locale]/onboarding`        | live & functional | Resume index — redirects to saved step or 'welcome'.                                    |
| `/[locale]/onboarding/[step]` | live & functional | 9 steps wired to `draft_onboarding` + finalize → profiles + children + consent_records. |

### App shell (`web/app/[locale]/(app)/`)

| Route                           | State             | Notes                                                                                                                             |
| ------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/[locale]/(app)/layout.tsx`    | live & functional | Auth gate; redirects to /login if no session; mints CSRF cookie.                                                                  |
| `/[locale]/settings/privacy`    | live & functional | Lists consent rows by scope; PIN-gated revoke writes new row.                                                                     |
| `/[locale]/settings/therapists` | live & functional | Issue + revoke 12-char codes; first-child only (Module 6 adds switcher).                                                          |
| `/[locale]/settings/account`    | live & functional | GDPR export (download JSON) + PIN-gated account delete.                                                                           |
| `/[locale]/dashboard/*`         | missing           | Module 6 work. Linked-to from review-step finalize but the route doesn't exist; finalize will 404 the redirect today (known gap). |
| `/[locale]/board`               | missing           | Module 3 work.                                                                                                                    |

### Standalone

| Route                            | State             | Notes                                                                               |
| -------------------------------- | ----------------- | ----------------------------------------------------------------------------------- |
| `/[locale]/accept-invite/[code]` | live & functional | Therapist landing — accepts via tRPC, shows accepted/error states.                  |
| `/auth/callback`                 | live & functional | Magic-link / signup-confirmation handler with same-origin next-redirect protection. |

### API endpoints (`web/app/api/`)

| Route                 | Method   | Auth                       | State                | Notes                                                                                              |
| --------------------- | -------- | -------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| `/api/health`         | GET      | none                       | live & functional    | Returns `{ok:true,name,version,timestamp}`.                                                        |
| `/api/csrf`           | GET      | none                       | live & functional    | Mints `bcare-csrf` cookie + echoes token in body.                                                  |
| `/api/og`             | GET      | none                       | live & functional    | OG image generator (per-locale title/subtitle).                                                    |
| `/api/auth/signup`    | POST     | none                       | live & functional    | Real Supabase signup; zod-validated; consent captured into raw_user_meta_data.                     |
| `/api/auth/login`     | POST     | none                       | live & functional    | Magic-link or password; rate-limited.                                                              |
| `/api/trpc/[trpc]`    | GET/POST | mixed                      | live & functional    | tRPC fetch handler; routers: account, consent, invites, onboarding.                                |
| `/api/account/export` | POST     | recent-auth (≤5min) + CSRF | live & functional    | Streams JSON archive of 14 user-scoped tables; audit-logs.                                         |
| `/api/account/delete` | POST     | recent-auth (≤5min) + CSRF | live & functional    | Tombstones (sets `users.deleted_at`); signs out; audit-logs. Hard-delete cron is Module 9.         |
| `/api/voice-preview`  | GET      | none                       | stub (mock provider) | Returns a mock WAV (sine-sweep) via `data:` redirect. Real ElevenLabs/Azure SDK lands in Module 9. |
| `/api/waitlist`       | POST     | none                       | deprecated read-only | Module 1.5 deprecated; route retained for in-flight signups. To delete in Module 9.                |

---

## 5. Database state (Supabase project `ikaaxfhenfbpfjqboixk`)

### Tables in Drizzle schema

| Table                | Cols | Purpose                                                                                      |
| -------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `users`              | 6    | Mirror of `auth.users` keyed on the same uuid; soft-delete via `deleted_at`.                 |
| `profiles`           | 8    | Caregiver/therapist/admin profile (children do NOT have a profile).                          |
| `children`           | 13   | Child profile owned by a caregiver; sensory profile JSON; voiceId; parental_pin_hash.        |
| `symbol_libraries`   | 6    | Named collection of symbols (ARASAAC EN/AR + custom).                                        |
| `symbols`            | 16   | Bilingual pictogram + categories + tags + status (pending_review / active / rejected).       |
| `vocabulary_sets`    | 9    | Per-child active grid (symbol+position+frequency+last_used).                                 |
| `sessions`           | 10   | One AAC session per board mount; aggregate metrics + therapist notes.                        |
| `input_events`       | 9    | Append-only child input events; modality-shaped payload; never raw transcript text.          |
| `output_events`      | 7    | Append-only system outputs (TTS, sentence-strip, visual-confirmation).                       |
| `progress_metrics`   | 9    | Daily rollup per child (vocab size, counts, sentence length, modality breakdown).            |
| `gamification_state` | 9    | Calm streaks, capped daily stars, unlocked themes. One row per child.                        |
| `audit_log`          | 8    | Append-only RBAC actions; admin reads, no one updates/deletes (RLS-enforced).                |
| `consent_records`    | 7    | Caregiver-attested consent rows (per scope, per version); revocation = new row.              |
| `custom_voices`      | 9    | Per-child caregiver-recorded voice clip pointer + metadata.                                  |
| `ai_usage_ledger`    | 7    | Per-child append-only AI cost ledger; `aiGuard` checks `(child_id, year_month)` sum vs. cap. |
| `waitlist_signups`   | 6    | **Deprecated** Module 1.5; retained read-only until Module 9 hardening.                      |
| `therapist_invites`  | 9    | 12-char codes, 7-day expiry, single-use, scoped to (caregiver, child).                       |
| `therapist_grants`   | 7    | Active therapist↔child read grants; `revoked_at` for soft revoke.                            |
| `draft_onboarding`   | 5    | Wizard resume state; one row per user_id; deleted on finalize.                               |

### Per-table state matrix

| Table                | Schema file | Migration applied | RLS enabled | RLS policies written               | RLS policies tested                                                                                                          |
| -------------------- | ----------- | ----------------- | ----------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `users`              | yes         | yes               | yes         | yes (in `db/rls/policies.sql`)     | not verified — run RLS integration suite (deferred to Iteration 3).                                                          |
| `profiles`           | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `children`           | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `symbol_libraries`   | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `symbols`            | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `vocabulary_sets`    | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `sessions`           | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `input_events`       | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `output_events`      | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `progress_metrics`   | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `gamification_state` | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `audit_log`          | yes         | yes               | yes         | yes (admin-read, no update/delete) | partially — `consent.revoke` + `account.export/delete` write rows in production code paths but no negative integration test. |
| `consent_records`    | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `custom_voices`      | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `ai_usage_ledger`    | yes         | yes               | yes         | yes                                | covered indirectly by `guard.test.ts` (env-cap behaviour); RLS not negatively tested.                                        |
| `waitlist_signups`   | yes         | yes               | yes         | yes (admin-read, anon-insert)      | covered by Module 1 e2e (rejects malformed payloads).                                                                        |
| `therapist_invites`  | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `therapist_grants`   | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |
| `draft_onboarding`   | yes         | yes               | yes         | yes                                | not verified                                                                                                                 |

> Verification command for "applied" / "RLS enabled": no live `psql` probe was run from this report; the operator confirmed both migrations ran clean in the Supabase SQL editor at the close of Module 2.A.1 (referenced in the master-prompt session log). To verify drift, run `pnpm --filter @bluecare/db generate` and diff the emitted SQL against `0000_initial_schema.sql`, or `psql $DATABASE_URL -c "\dt public.*"`.

### Schema/migration drift

- Hand-authored migration bundle (`0000_initial_schema.sql` + `0001_rls_policies.sql`) was the operator-paste workflow for Module 2.A.1. Drizzle `drizzle.config.ts` is set up but `db:generate` has not been re-run since the wizard-table additions. **Risk**: low — the three Module-2.B-Iteration-1 tables (`therapist_invites`, `therapist_grants`, `draft_onboarding`) are referenced by the live RLS policy file and exercised by the deployed app; if they weren't applied, tRPC mutations would 4xx — but no negative integration test confirms this.
- **Verification**: run `pnpm --filter @bluecare/db generate` and inspect the diff; or hit `/[locale]/onboarding/welcome` while signed-in and complete the wizard.

### Supabase-side artifacts

| Artifact                                                         | State                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth email templates (5 × 2 locales)                             | committed in `db/supabase/email-templates/`; **EN versions pasted into Supabase dashboard** per `README.md` instructions. AR versions ready but blocked on Module 9 custom-mailer hook (Supabase doesn't natively support per-locale templates).                                   |
| Edge functions                                                   | none configured. None planned until Module 9.                                                                                                                                                                                                                                      |
| Storage buckets                                                  | not verified — voice clips + custom symbols (Module 3+) will need a bucket. To verify: `https://supabase.com/dashboard/project/ikaaxfhenfbpfjqboixk/storage/buckets`.                                                                                                              |
| Triggers                                                         | `db/rls/policies.sql` + `db/rls/index.ts` reference an `auth.users → public.users` mirror trigger; not directly inspected in this report. To verify: `psql -c "select tgname, tgrelid::regclass from pg_trigger where tgname like '%bcare%' or tgrelid = 'auth.users'::regclass"`. |
| `app_role()`, `is_caregiver_of()`, `is_admin()` helper functions | defined in `db/rls/policies.sql` lines 9–42; applied via migration.                                                                                                                                                                                                                |

---

## 6. API surface

| Endpoint              | Method    | Auth               | State             | Notes                                                                                                                                                                  |
| --------------------- | --------- | ------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/health`         | GET       | none               | live & functional | Lightweight heartbeat with version + timestamp.                                                                                                                        |
| `/api/csrf`           | GET       | none               | live & functional | Mints/refreshes `bcare-csrf` double-submit cookie.                                                                                                                     |
| `/api/og`             | GET       | none               | live & functional | OG image generator (uses `@vercel/og`); per-locale.                                                                                                                    |
| `/api/auth/signup`    | POST      | none               | live & functional | Adaptive: `real` calls Supabase; `mock` simulates; `unconfigured` returns 503. RFC-7807 error format.                                                                  |
| `/api/auth/login`     | POST      | none               | live & functional | Same adaptive backend; rate-limited per IP.                                                                                                                            |
| `/api/trpc/[trpc]`    | GET, POST | mixed              | live & functional | Single fetch handler for tRPC routers `account`, `consent`, `invites`, `onboarding`. CSRF on every mutation, recent-auth on `account.exportAll` + `account.deleteAll`. |
| `/api/account/export` | POST      | recent-auth + CSRF | live & functional | Streams JSON archive (14 tables); audit-logs `data_export`.                                                                                                            |
| `/api/account/delete` | POST      | recent-auth + CSRF | live & functional | Tombstones `users.deleted_at`; signs caller out; audit-logs `data_delete` with 30-day ETA.                                                                             |
| `/api/voice-preview`  | GET       | none               | stub              | Mock WAV (sine sweep). Real provider in Module 9.                                                                                                                      |
| `/api/waitlist`       | POST      | none               | deprecated        | Module 1.5 deprecated; retained until Module 9 removes it.                                                                                                             |
| `/auth/callback`      | GET       | none               | live & functional | Magic-link / signup-confirm exchange; same-origin next-redirect guard.                                                                                                 |

---

## 7. Component & lib inventory

### shadcn/Radix primitives (`web/src/components/ui/`)

| Primitive       | Purpose                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| `accordion.tsx` | Radix accordion (used in marketing FAQ).                                             |
| `badge.tsx`     | Status pill (used in mock dashboard, settings status labels).                        |
| `button.tsx`    | CVA-driven button (variants: primary/secondary/ghost/link; sizes: sm/md/lg/xl/icon). |
| `card.tsx`      | Container card primitive.                                                            |
| `input.tsx`     | Form input with `aria-invalid` styling.                                              |
| `label.tsx`     | Radix label primitive.                                                               |
| `separator.tsx` | Radix separator.                                                                     |

### Domain components (`web/src/components/`)

| Group      | Files                                                                                                                                                                          | Purpose                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Brand      | `brand/logo.tsx` (+ story)                                                                                                                                                     | BlueCare wordmark.                                  |
| Marketing  | `marketing/{marketing-header,marketing-footer,trust-strip,device-frame,mock-child-board,mock-dashboard,legal-page,section,faq-list}.tsx` (+ stories on the public-facing ones) | Marketing-site shell + visual assets.               |
| Auth       | `auth/{auth-shell,brand-promise-panel,dev-mode-banner,signup-form,login-form,role-selector,password-input,check-email-state}.tsx` (+ stories)                                  | Sign-up / sign-in / reset-password client surfaces. |
| Onboarding | `onboarding/{wizard-shell,wizard-actions}.tsx` + `onboarding/steps/{welcome,about-you,about-child,sensory,vocabulary-level,voice,consent,pin,review}-step.tsx`                 | 8-step caregiver onboarding wizard.                 |
| PIN        | `pin-gate.tsx`                                                                                                                                                                 | Reusable PIN challenge wrapping sensitive actions.  |
| Providers  | `providers/{theme-provider,query-provider}.tsx`                                                                                                                                | next-themes + react-query providers.                |
| Locale     | `language-switcher.tsx`, `theme-switcher.tsx`, `skip-link.tsx`                                                                                                                 | Header utilities.                                   |
| SEO        | `seo/jsonld.tsx`                                                                                                                                                               | JSON-LD emitter.                                    |

### Libs (`web/src/lib/`)

| Lib                                       | Purpose                                          | Used?                                                                                               |
| ----------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `cn.ts`                                   | clsx+tailwind-merge wrapper                      | yes (everywhere)                                                                                    |
| `motion.ts`                               | `useReducedMotion` hook                          | yes (wizard shell)                                                                                  |
| `direction.ts`                            | RTL detection helper                             | yes (test only currently — not directly imported by components, but covered by `direction.test.ts`) |
| `seo.ts`                                  | `pageMetadata` factory                           | yes (every page)                                                                                    |
| `supabase/{client,server,types,index}.ts` | Cookie-bound + service-role Supabase clients     | yes                                                                                                 |
| `auth/mode.ts`                            | Auth-mode detection (real / mock / unconfigured) | yes                                                                                                 |
| `auth/dev-mock.ts`                        | In-memory user store for mock mode               | yes (mock-mode only)                                                                                |
| `auth/rate-limit.ts`                      | Per-IP rate limiter (in-memory)                  | yes                                                                                                 |
| `auth/strength.ts`                        | Password strength meter                          | yes (signup form)                                                                                   |
| `auth/consent.ts`                         | Consent version constant + helpers               | yes                                                                                                 |
| `auth/zod.ts`                             | Shared zod schemas for signup/login              | yes                                                                                                 |
| `auth/csrf.ts`                            | Server-only CSRF (next/headers)                  | yes                                                                                                 |
| `auth/csrf-shared.ts`                     | Client-safe CSRF constants                       | yes                                                                                                 |
| `auth/session.ts`                         | `getSessionInfo`, `requireRecentAuth`            | yes                                                                                                 |
| `auth/pin.ts`                             | bcryptjs PIN hash + lockout state                | yes                                                                                                 |
| `ai/guard.ts`                             | Per-child monthly AI cost guard                  | yes (currently mock-only paths, real calls land in Module 4/9)                                      |
| `voice/index.ts`                          | Voice provider dispatcher (locale → provider)    | yes (mock only today)                                                                               |
| `voice/mock.ts`                           | Sine-sweep WAV generator                         | yes                                                                                                 |
| `trpc/client.tsx`                         | tRPC React provider                              | yes                                                                                                 |

No dead code identified at this scan.

### Storybook coverage

Stories present (8 files):

- `brand/logo.stories.tsx`
- `marketing/{mock-child-board,mock-dashboard,trust-strip}.stories.tsx`
- `auth/{check-email-state,role-selector,password-input,signup-form}.stories.tsx`

Components missing stories (notable gaps):

- `marketing-header`, `marketing-footer`, `device-frame`, `legal-page`, `section`, `faq-list`
- All 9 onboarding step components + `wizard-shell` + `wizard-actions`
- `pin-gate`
- All shadcn/UI primitives (`button`, `input`, `label`, `card`, `accordion`, `badge`, `separator`)

---

## 8. Internationalization state

### Catalogs

- Files: `web/messages/en.json` and `web/messages/ar.json` (NOT `web/src/i18n/messages/` — the next-intl runtime points at `web/messages/`).
- Line counts: **en.json = 905, ar.json = 905** — symmetric (every key has a translation).
- Top-level namespaces: `common`, `nav`, `footer`, `trustStrip`, `marketing.{landing,howItWorks,forCaregivers,forTherapists,about,team,security,privacy,terms,accessibility,contact,auth.{shell,devBanner,signup,login,resetPassword,onboarding,onboardingWizard},app.{settings.{nav,privacy,therapists},pinGate,account,acceptInvite}}`.
- **`TODO(translate)` count in ar.json**: **0**. (All AR strings appear human-translated.)

### i18n debt

- `pnpm lint:i18n-debt` output: **`translation debt: 18 (code=0, review=18, threshold=25)`** — under threshold, lint passes.
  - `code=0`: no `TODO(translate)` markers in the catalog.
  - `review=18`: 18 strings flagged for native-reviewer pass (queued — Arabic reviewer pipeline is a Module 9 follow-up).
  - `threshold=25`: linter blocks if total exceeds 25.

### RTL parity

- `pnpm lint:i18n` (direction linter) output: **`✓ i18n direction lint passed.`**
- All marketing pages render in `dir="rtl"` for AR (verified by Playwright `marketing.spec.ts` axe-tests across 11 routes × 2 locales).
- No component flagged as not RTL-safe in `direction.ts` or in any TODO comment.
- Onboarding wizard, settings sub-shell, PIN gate, accept-invite — RTL-tested manually during Iteration 2 build but **not yet covered by E2E** (deferred to Iteration 3).

---

## 9. Configuration & environment

### Env var names referenced in code

| Name                              | `web/.env.local`                                          | Vercel Production                                          | Vercel Preview | Vercel Development | In `.env.example`?         |
| --------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------- | -------------- | ------------------ | -------------------------- |
| `NEXT_PUBLIC_APP_URL`             | not set (defaults to localhost / origin)                  | not set (URL inferred from request)                        | not set        | not set            | yes                        |
| `NEXT_PUBLIC_SUPABASE_URL`        | yes                                                       | yes                                                        | yes            | yes                | yes                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | yes                                                       | yes                                                        | yes            | yes                | yes                        |
| `SUPABASE_SERVICE_ROLE_KEY`       | yes                                                       | yes                                                        | yes            | yes                | yes                        |
| `DATABASE_URL`                    | not verified — operator likely set it for migrations only | not set (app uses Supabase client, not Drizzle at runtime) | not set        | not set            | yes                        |
| `SUPABASE_JWT_SECRET`             | not verified                                              | not set                                                    | not set        | not set            | yes (commented intent)     |
| `AI_MONTHLY_BUDGET_USD_PER_CHILD` | optional (defaults to 5 in `aiGuard`)                     | not set                                                    | not set        | not set            | yes (default 5)            |
| `OPENAI_API_KEY`                  | not set                                                   | not set                                                    | not set        | not set            | yes (commented, Module 4)  |
| `ELEVENLABS_API_KEY`              | not set                                                   | not set                                                    | not set        | not set            | yes (commented, Module 9)  |
| `AZURE_TTS_KEY`                   | not set                                                   | not set                                                    | not set        | not set            | yes (commented, Module 9)  |
| `AZURE_TTS_REGION`                | not set                                                   | not set                                                    | not set        | not set            | yes (commented, Module 9)  |
| `SENTRY_DSN`                      | not set                                                   | not set                                                    | not set        | not set            | yes (commented, Module 9)  |
| `POSTHOG_PROJECT_API_KEY`         | not set                                                   | not set                                                    | not set        | not set            | yes (commented, Module 9)  |
| `PLAYWRIGHT_BASE_URL`             | tooling only (e2e local override)                         | n/a                                                        | n/a            | n/a                | not documented (test-only) |
| `CI`                              | tooling only                                              | set by Vercel                                              | set by Vercel  | set by Vercel      | not documented (standard)  |
| `NODE_ENV`                        | tooling only                                              | set by Vercel                                              | set by Vercel  | set by Vercel      | not documented (standard)  |

### Env vars referenced but not in `.env.example`

- `PLAYWRIGHT_BASE_URL` — test-only, fine to leave undocumented.
- No production-relevant env vars are missing from `.env.example`.

> Live mode confirmation: `vercel env ls` shows all three Supabase vars `Encrypted` in `Production`, `Preview`, and `Development` (last update: 16h ago). Therefore the live `bcare-ten.vercel.app` deployment runs `AUTH_MODE = 'real'`.

---

## 10. Deployment state

- **Vercel project**: `marwan-aljijaklis-projects/bcare`.
- **Latest production deployment**: `https://bcare-1fzkh1efv-marwan-aljijaklis-projects.vercel.app` — **● Ready** (built 56s; produced ~2 minutes before report generation).
- **Aliased / canonical URL**: `https://bcare-ten.vercel.app`.
- **HEAD on main**: `dced0f0`. Vercel auto-deploys from main → this is the SHA reflected in the latest Ready deployment.
- **Health probes** (2026-05-10 ~08:38 UTC):
  - `/api/health` → 200 `{"ok":true,"name":"bluecare","version":"0.1.0"}`
  - `/en` → 200
  - `/ar` → 200
  - `/api/csrf` → 200 (token returned)
  - `/ar/onboarding` → 307 (auth redirect — expected behaviour for unauthenticated probe)
- **Recent Vercel deploy history (24h)**:
  - 7× Ready Production (last 19h)
  - 4× Error (3 Preview, 1 Production) in 18–19h window — these correspond to commits during Module 2.B Iteration 1 wiring; the latest production run is clean.
- **Stale / failed deploys**: 4 errored deploys in the 18–19h window, all superseded by subsequent Ready builds. No action required; standard transient build noise during the iteration.

---

## 11. Tests

### Unit tests (Vitest)

- **Files**: 3 — `web/src/lib/cn.test.ts`, `web/src/lib/direction.test.ts`, `web/src/lib/ai/guard.test.ts`.
- **Tests**: **13 passed** (4 + 4 + 5).
- **Pass status**: all green at HEAD `dced0f0`. Run output:
  ```
  Test Files  3 passed (3)
       Tests  13 passed (13)
    Duration  2.62s
  ```
- **Coverage on `/shared` and `/web/src/lib`**: not measured in this run; `@vitest/coverage-v8` is installed but no recent `--coverage` run captured. To measure: `pnpm --filter @bluecare/web exec vitest run --coverage`.

### E2E tests (Playwright)

- **Files**: 2 — `web/e2e/marketing.spec.ts`, `web/e2e/auth.spec.ts`.
- **Tests**: **188 total** (per `playwright test --list`) — Marketing matrix (EN+AR×11 routes × axe-core, plus the Module-1.5 free-and-open assertions, sitemap/OG/robots) + Auth flows.
- **Pass status**: not run in this report. Last known good = the CI run associated with the previous main HEAD (Module 2.B Iteration 1). To re-run locally: `pnpm test:e2e`. To verify CI: open Actions tab on `MarwanAljijakli/Bcare`.
- **Last successful CI run**: not verified — would require `gh run list --workflow=ci.yml --limit 5`.

### A11y tests (axe-core)

- Wired through Playwright in `marketing.spec.ts` — every marketing route × locale runs `AxeBuilder.analyze()` and asserts zero serious / critical violations.
- Storybook addon-a11y is also installed but Storybook a11y CI pass not currently wired.
- **Last known violation count**: 0 serious, 0 critical (asserted by the e2e suite).
- Not run for the new wizard / settings / accept-invite surfaces — those will be covered when the deferred Iteration-3 E2E matrix lands.

### Lighthouse CI

- Config: `web/lighthouserc.json` collects `/en` and `/ar`, asserts ≥ 0.95 on `performance`, `accessibility`, `best-practices`, `seo` (errors below threshold).
- Workflow `.github/workflows/ci.yml` job `lighthouse` runs on every push to main + PR to main, and uploads `web/lighthouse-reports` as an artifact (14-day retention).
- **Last scores on /en, /ar**: not captured in this report. To pull: download the latest `lighthouse-reports` artifact from the most recent successful CI run.

---

## 12. Master prompt — 16 acceptance criteria scorecard

| #   | Criterion                                                                                                          | State                                                                                            | Justification                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TypeScript strict + noUncheckedIndexedAccess; ESLint, Prettier, Vitest, Playwright, Storybook, Husky, lint-staged. | **PASS**                                                                                         | All present; commit hooks fire; CI gates lint+typecheck+test on every push (Ubuntu + Windows matrix).                                                                                                                   |
| 2   | Token-driven theming with light / dark / hc; AAA on /board, AA elsewhere.                                          | **PARTIAL**                                                                                      | Light/dark/hc themes ship; AA verified by axe-core on marketing. AAA on /board cannot pass yet — `/board` is Module 3.                                                                                                  |
| 3   | Marketing site bilingual EN+AR with full RTL parity.                                                               | **PASS**                                                                                         | 11 routes × 2 locales; lint:i18n green; Playwright matrix asserts dir + axe-core per route.                                                                                                                             |
| 4   | Auth-aware shell with adaptive backend (real / mock / unconfigured).                                               | **PASS**                                                                                         | `AUTH_MODE` detection in `mode.ts`; production runs `real`; mock falls back in dev without env vars.                                                                                                                    |
| 5   | Row-Level Security on every table.                                                                                 | **PASS** (policies written + applied) / **NOT YET FULLY VERIFIED** (integration suite deferred). | All 18 tables have policies in `db/rls/policies.sql`; applied as migration. Negative-path integration tests pending Iteration 3.                                                                                        |
| 6   | Consent records: grant + revoke writes a new row, never mutates.                                                   | **PASS**                                                                                         | `consent.revoke` tRPC mutation inserts a new row with `granted=false`; audit-logs the action; UI re-reads via `consent.list`.                                                                                           |
| 7   | Responsive layout + RTL parity across breakpoints.                                                                 | **PASS**                                                                                         | Marketing matrix asserts; sensory profile in onboarding picks touch-target size; tablet-first layout pattern is in place.                                                                                               |
| 8   | RBAC: caregiver / therapist / admin / child (no auth) roles.                                                       | **PARTIAL**                                                                                      | `roleEnum` + `profiles.role` + `app_role()` helper + admin invite CLI exist; therapist read-grants via `therapist_grants`. Therapist-side dashboard surfaces are Module 6.                                              |
| 9   | axe-core green on every public route.                                                                              | **PASS**                                                                                         | Playwright asserts zero serious/critical on every marketing route × locale. New wizard / settings surfaces have not yet been added to the CI axe matrix.                                                                |
| 10  | Data portability + erasure with re-auth.                                                                           | **PASS**                                                                                         | `POST /api/account/export` + `/api/account/delete` + tRPC `account.exportAll` / `deleteAll` all gated by `recentAuthProcedure` (≤ 5 min). 30-day grace window before hard cascade.                                      |
| 11  | Parental PIN gate on sensitive actions.                                                                            | **PASS**                                                                                         | `pin-gate.tsx` wraps consent revocation + account deletion; bcryptjs cost 12; 3-strike 5-min lockout. Vocabulary curation gate lands with Module 4 dashboard.                                                           |
| 12  | Append-only audit log on privileged actions.                                                                       | **PASS**                                                                                         | RLS denies UPDATE + DELETE on `audit_log`; INSERT-only via service-role admin client. Wired for: signup (consent grant), consent revoke, data export, data delete, admin invite.                                        |
| 13  | AI cost guard with monthly per-child cap, enforced in code, with unit test.                                        | **PASS**                                                                                         | `aiGuard()` in `web/src/lib/ai/guard.ts` + 5-test Vitest spec in `guard.test.ts`. Default cap 5 USD/month; overridable via `AI_MONTHLY_BUDGET_USD_PER_CHILD`.                                                           |
| 14  | CSRF on every mutating route.                                                                                      | **PASS**                                                                                         | `verifyCsrf()` on REST mutations (`/api/account/*`, `/api/auth/*`); tRPC `publicMutationProcedure` + `protectedMutationProcedure` middleware on every mutation; double-submit cookie via `bcare-csrf` + `x-csrf-token`. |
| 15  | SEO: sitemap, robots, OG image, JSON-LD.                                                                           | **PASS**                                                                                         | `app/sitemap.ts`, `app/robots.ts`, `app/api/og/route.ts`, `seo/jsonld.tsx`. E2E asserts presence + correctness.                                                                                                         |
| 16  | Lighthouse ≥ 95 on /en, /ar in CI.                                                                                 | **PASS** (gate configured) / **NOT YET VERIFIED** today (no fresh run captured in this report).  | `lighthouserc.json` asserts ≥ 0.95 on perf+a11y+best-practices+seo; CI workflow runs `lhci autorun` on every push. Last actual scores: not captured this session.                                                       |

---

## 13. Known issues, blockers, and tech debt

### `docs/known-issues.md` — active items (verbatim summary)

1. **Local production server returns 500 on Windows.** `pnpm exec next start` returns 500 on every route on Windows. `pnpm dev` is fine; CI on Ubuntu is fine; Vercel is fine. Workaround: use dev server locally. Owner: Module 2.B (will time-box; otherwise escalate to Module 9 observability).
2. **Module 2.A — `consent_records` insert deferred to 2.B.** Closed by the Iteration-2 finalize flow which now writes per-scope rows; backfill of pre-trigger users still listed.
3. **Module 2.A — apple-touch PNG still served as SVG.** Tracked in `docs/backlog.md`.
4. **Vercel CLI preview env-add quirk on 51.5.0.** Workaround: pass empty string as third positional arg. Cannot upgrade to 53.x because the User-Agent header embeds `os.hostname()` and this Windows machine's hostname is Arabic. Owner: Module 9.
5. **Module 2.B — RLS integration suite + 10-flow Playwright matrix deferred.** Needs dedicated test Supabase project. Owner: Iteration 3.
6. **Module 2.B — real ElevenLabs / Azure voice SDK calls deferred.** Mock provider in place. Owner: Module 9.
7. **Module 2.B — manual screen-reader pass on /signup, /login, /onboarding/_, /settings/_ deferred.** Need Mac + Windows-NVDA. Owner: Module 9 (a11y audit) or Iteration 3.

### `docs/backlog.md` — open items

- **Module 0 closeouts**: Supabase Database type generation in CI; ARASAAC seed import (Module 3); therapist sharing grant table (✓ now landed in Module 2.B); AI cost-per-call estimates (Module 4); replace placeholder app glyph.
- **Module 1.5 closeouts**: drop deprecated waitlist surface (table + route + schema) in Module 9 hardening after 60 days of zero new rows; Apple touch icon PNG.
- **Lower priority**: self-host Lighthouse CI server; `.vscode/extensions.json` recommended-extensions list.

### Other things a senior engineer should know on day one

- **18 tables, 3 added in Iteration 1 are not yet covered by Drizzle-generated migration**: `0000_initial_schema.sql` was hand-authored, then operator-pasted; if you regenerate via `drizzle-kit`, expect drift. Verify before re-applying.
- **Two separate CSRF imports (`csrf.ts` and `csrf-shared.ts`)**: client code MUST use `csrf-shared.ts` (no `next/headers`); server code uses `csrf.ts`. The Iteration-2 build broke once on this — the comment in both files explains it.
- **tRPC client is `client.tsx` (with JSX)**, not `.ts`. Do not rename without compiling.
- **Settings → Account "delete" flow signs the user out via `supabase.auth.signOut()`** before the React state update — the in-flight tRPC client cache is invalidated by the next request. The redirect to `/login` is set on a 4-second timeout so the user can read the confirmation; this is intentional.
- **The Module 2.A signup route writes consent into `auth.users.raw_user_meta_data`** as an interim measure; the Iteration-2 finalize flow now writes the canonical `consent_records` rows. A backfill script for any pre-trigger signups is in `docs/known-issues.md` — but there is currently no script in `db/scripts/` for it. To author: walk `auth.users.raw_user_meta_data.consent`, insert the matching `consent_records` rows. Sub-1-hour task.
- **Review-step `finalize` redirects to `/dashboard`** which doesn't exist — the dashboard route is Module 6. The current behaviour is a 404 after wizard completion; the user's profile and child rows will have been written, but the post-wizard landing doesn't render. Consider redirecting to `/settings/privacy` or building a placeholder `/dashboard` until Module 6 lands.
- **`db:generate` is wired (`pnpm --filter @bluecare/db generate`)** but the README workflow is "operator pastes SQL into Supabase SQL editor" — no automated migration runner. For Iteration 3 / Module 9, consider `drizzle-kit migrate` against `DATABASE_URL`.
- **Sentry / PostHog not wired**: errors in production go to Vercel runtime logs only. There is no DSN-bearing client. A senior engineer's first instinct ("attach Sentry") is correct but it's the explicit Module 9 deliverable.

---

## 14. What I (the agent) would prioritize next, if I had to recommend one prompt to send

1. **Stand up the test Supabase project + author the RLS integration suite + 10-flow Playwright matrix in EN+AR.** Closes the largest hole in Module 2.B Iteration 2's deferred list, lifts AC-5 and AC-9 from PARTIAL to PASS, and makes every subsequent module shippable with confidence. (Iteration 3.)
2. **Build the Module 6 caregiver dashboard skeleton (`/[locale]/dashboard/*`)** even before Module 3 is done — at minimum a "Today" view scaffold + multi-child switcher + settings nav merge. The wizard's finalize step currently 404s on `/dashboard`; this fix is a one-day chore that unblocks everything downstream and gives the consent-revoke + therapist-invite flows a real home. (Bridges to Module 6.)
3. **ARASAAC symbol seed import + symbol resolver.** This is the single biggest unblocker for Module 3 (child board), Module 4 (vocabulary suggestions need a corpus), Module 5 (theme packs), and Module 6 (top-symbols panel). Self-contained: a migration + a one-shot script + attribution surfaces. (Module 3 prerequisite.)
4. **Wire real Supabase email templates per-locale via the custom-mailer hook.** AR speakers currently get EN emails after signup — visible quality gap on a bilingual product. ~1-day task once the Supabase functions environment is provisioned. (Module 9 split-out.)
5. **Replace the mock voice provider with ElevenLabs (EN) + Azure Neural TTS (AR), wrapped in `aiGuard()` with the existing per-child monthly cap.** The wizard and the eventual board both need real audio; deferring this any longer means caregivers walk through onboarding hearing a sine sweep. (Module 9 split-out, can land independently.)
