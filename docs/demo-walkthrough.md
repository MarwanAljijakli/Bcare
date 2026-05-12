# BlueCare demo walkthrough

A 10-step click-path designed for a first-time visitor — a supervisor,
a family member, a classmate — to see the most impressive parts of
BlueCare in the right order. Total time: ~5 minutes.

**Live URL**: <https://bcare-ten.vercel.app>

Before you start: BlueCare is still in development bypass mode. There
is no sign-up form to fill in. The moment you click "Get started"
you are auto-signed-in as "Test Caregiver" with one demo child set up.
The yellow banner at the top of every page is the visible reminder of
this state. It disappears once we flip to real auth at launch.

---

## Step 1 — Land on the marketing site (30 sec)

**Click**: <https://bcare-ten.vercel.app/en>

**What you'll see**:

- A trust-blue hero with the BlueCare wordmark and the headline
  "Communication for children with autism."
- A short value-prop subhead and a "Get started" CTA button.
- A trust strip below — bilingual, AAA-contrast, AAC-research-driven,
  research-aligned.
- The yellow DevModeBanner across the top: "Development bypass mode."

**Try**:

- Click the language toggle in the top-right → page flips to `/ar`.
- The entire layout mirrors to right-to-left. The headline becomes
  "تواصل ذكي للأطفال ذوي اضطراب طيف التوحد." Notice the brand mark
  also has an Arabic wordmark variant.
- Click the theme toggle (sun/moon) — page goes dark with the same
  AAA contrast preserved.
- Flip locale back to /en and theme back to light.

> **Screenshot here**: marketing landing in EN, light theme, with DevModeBanner.

> **Screenshot here**: the same view in /ar, dark theme.

---

## Step 2 — Get started → auto-signin → dashboard (10 sec)

**Click**: "Get started" button on the landing page.

**What happens**: under bypass mode, instead of showing a signup form,
BlueCare immediately mints a session for the test caregiver and routes
you straight to `/en/dashboard`.

**What you'll see on the dashboard**:

- A header with the BlueCare logo, an "Admin" link (visible because
  the test caregiver was promoted to admin for the demo), a theme
  toggle, and a language toggle.
- A greeting: "Welcome back" + first name.
- 4 hero stat tiles (today's stars, current streak, longest streak,
  active vocabulary size).
- A "Today" panel with modality breakdown and success rate.
- A recent-sessions table.
- A streak callout, pending AI suggestions card, top symbols card.
- A 30-day vocabulary-growth sparkline.
- A 6-tile quick-actions footer: Board · Personalization · Themes ·
  Therapists · Reports · Settings.

> **Screenshot here**: full dashboard, EN, light theme.

---

## Step 3 — Open the board, tap symbols, speak (60 sec)

**Click**: "Open the board" in the quick-actions footer.

**What you'll see**:

- A grid of picture tiles — 40 starter symbols for the demo child.
- A category rail on the right (food, feelings, people, actions…).
- A sentence-strip at the top of the page.
- Three input modes: tap (default), hold-to-speak, gesture (off by
  default).
- A Speak button + a Clear button.

**Try**:

- Tap 2-3 tiles — say "I want" + "water". Each tile adds a token to
  the sentence strip.
- Tap **Speak**.
- **Listen** — you'll hear the assembled phrase spoken by OpenAI's
  "Nova" voice. It is warm, child-friendly, and clear.

> **Screenshot here**: board with "I want water" assembled in the strip
> and the Speak button highlighted.

---

## Step 4 — Switch to Arabic, hear Charlotte (60 sec)

**Click**: the language toggle in the page header — switches to
`/ar/board`.

**What you'll see**:

- The board mirrors right-to-left. The category rail moves to the
  left. The sentence strip reads right-to-left.
- The same symbols now show Arabic labels ("ماء", "أريد", "تفاح"…).

**Try**:

- Tap "أريد" + "ماء".
- Tap **تحدّث** (Speak).
- **Listen** — you'll hear the phrase spoken by ElevenLabs' "Charlotte"
  voice. It is the most natural Saudi-dialect Arabic voice we tested.

> **Screenshot here**: /ar/board with "أريد ماء" in the strip.

---

## Step 5 — Try hold-to-speak (Whisper STT) (60 sec)

**Click**: Navigate to <https://bcare-ten.vercel.app/ar/voice-test>
(or use the Voice Test link from the admin nav).

**What you'll see**:

- A test surface with sample phrases + two TTS providers side-by-side
  (ElevenLabs vs OpenAI), and a mic-test panel below.

**Try**:

- Click "سجّل ٨ ثوانٍ" (Record 8 seconds).
- Allow microphone permission when the browser asks.
- Say something in Arabic — for example: "أريد أن آكل التفاح."
- Wait for the spinner to stop.
- **You'll see** the transcript appear underneath, along with
  `lang_detected=arabic`, the audio duration, and `avg_logprob`. The
  Whisper anti-hallucination filter rejects clips < 1 second AND
  near-silent clips AND known YouTube-subtitle bias patterns
  ("اشتركوا في القناة"); you'll see a friendly "We couldn't hear you
  clearly" prompt instead of a bogus transcript if the recording is
  too short.

> **Screenshot here**: voice-test page with a real Arabic transcript
> showing.

---

## Step 6 — Session replay (45 sec)

**Click**: From the dashboard, scroll to the Recent Sessions table.
Click any row.

**What you'll see at `/[locale]/dashboard/sessions/[id]`**:

- A chronological replay of the session — each symbol tap with a
  modality icon (tap / voice / gesture), the latency, and the
  timestamp.
- A "Speak" button that re-plays the assembled phrase via the same
  per-locale TTS pipeline.
- A therapist-notes textarea (4096 char) at the bottom — caregivers
  and therapists with active grants can write notes here. Every save
  is audit-logged.

**Try**:

- Click **Speak** on the assembled phrase — the same audio you
  generated live in step 3 plays back from the cache.
- Add a sample therapist note: "Demo session — focused on food
  symbols." Click Save.

> **Screenshot here**: session detail with the timeline + Speak button
>
> - notes editor visible.

---

## Step 7 — Personalization (Claude-powered suggestions) (30 sec)

**Click**: Quick actions footer → "Personalization." Or navigate
to `/en/dashboard/personalization`.

**What you'll see**:

- A list of vocabulary suggestions — words BlueCare thinks the child
  is ready for based on their usage patterns.
- Each suggestion has a source tag (`frequency` from pure
  aggregations, OR `llm` from Anthropic Claude Sonnet when the
  feature is opted in).
- Each row has Approve + Reject buttons.

> **Screenshot here**: personalization page with at least one
> Claude-source suggestion visible.

---

## Step 8 — PDF progress report (45 sec)

**Click**: Quick actions footer → "Export PDF report."

**What you'll see at `/[locale]/dashboard/reports`**:

- A child picker (single child in the demo).
- A window picker: Last 7 days / Last 30 days / Last 90 days.
- A summary card with session count, input count, successful
  selections, therapist notes count.
- A "Download PDF" button.

**Try**:

- Pick "Last 30 days."
- Click **Download PDF**.
- The PDF generates entirely in your browser via `@react-pdf/renderer`
  — the bytes never leave your device. The file lands in your
  Downloads folder as
  `bluecare-<child-name>-30d-2026-05-12.pdf`.
- Open it: bilingual progress report with a vocabulary growth chart,
  session frequency mini-chart, top symbols, multimodal breakdown,
  and any therapist notes from the window. The /ar version is
  RTL-laid-out and uses the Cairo font for both English and Arabic
  glyphs.

> **Screenshot here**: the PDF report open in a viewer, Arabic + RTL.

---

## Step 9 — Themes (gamification) (20 sec)

**Click**: Quick actions footer → "Themes."

**What you'll see at `/[locale]/dashboard/themes`**:

- A grid of unlockable visual themes for the board. Each one shows a
  preview, an unlock requirement (X consecutive days of activity, Y
  total stars), and a status badge: Locked / Unlocked / Equipped.

> **Screenshot here**: themes grid with one Unlocked and the rest
> Locked.

---

## Step 10 — Admin surface (45 sec)

**Click**: The "Admin" link in the dashboard header (or navigate
directly to `/en/admin`).

**What you'll see at `/[locale]/admin`** — the system health
2×2 grid:

- **Auth card**: Supabase project ref, magic-link route status, and a
  yellow "Bypass mode ON (dev)" badge.
- **Voice card**: 4 provider chips (ElevenLabs ✓ OpenAI ✓ Whisper ✓
  Claude ✓), cache hit rate, calls (30d), cost (30d).
- **Database card**: project ref, symbols row count (159), last
  migration applied (0011_drop_waitlist).
- **Deploy card**: app version, API heartbeat, last probe timestamp.

The card auto-refreshes every 30 seconds.

**Try the rest of the admin nav (left sidebar)**:

- **Users** — paginated list of every user in the system with role/
  locale/status filters and a keyboard-shortcut row navigation (press
  `j` and `k` to move, Enter to open a detail panel).
- **Symbol queue** — moderation surface for custom symbols submitted
  by caregivers awaiting approval. Bulk-approve + per-row reject with
  reason picker (blurry / wrong_subject / inappropriate / copyright /
  duplicate / other).
- **Audit log** — filterable read-only viewer over the full
  `audit_log` table. Filter by action (`sign_in`, `child_create`,
  `therapist_note_update`, `admin_action`, …), date window
  (7d/30d/90d), and actor email. Click any row to expand the metadata
  JSON.

> **Screenshot here**: /admin landing 2x2 grid + the Admin link
> highlighted in the header.

> **Screenshot here**: /admin/audit with at least one row expanded
> showing metadata JSON.

---

## Bonus — Help center

Skipped from the main path because most demo audiences won't read
documentation in a live session, but worth mentioning:

- `/en/help` and `/ar/help` ship 12 articles each (24 total). Each
  article has a sticky table-of-contents, copy-link buttons on every
  heading, and an anonymous "Was this helpful?" footer that audit-logs
  feedback. Search is Fuse.js fuzzy across titles + summaries + tags
  - bodies.

---

## What's NOT in the demo path

- **Real signup** — gated by the bypass-flip checklist
  ([docs/runbook.md](runbook.md) § "Pre-launch auth re-enablement").
- **Real password reset email** — works in code but needs Supabase
  Auth Hooks deployed for bilingual templates ([docs/pre-release-credentials.md](pre-release-credentials.md)).
- **Sentry / PostHog / Upstash** — code is wired; credentials live
  outside the demo environment ([docs/pre-release-credentials.md](pre-release-credentials.md)).
- **MediaPipe gesture mode** — opt-in feature flag, not enabled on
  the demo child.

---

## After the demo

Three places to send feedback:

1. **Verbal / written notes** — anything that felt rough, slow, or
   unclear. We capture everything.
2. **"Was this article helpful?" thumbs** on any /help page —
   anonymous, audit-logged.
3. **GitHub issues** at <https://github.com/MarwanAljijakli/Bcare/issues>
   for engineering-flavored bug reports.

Production launch unblocks once: (a) the 4 PARTIAL items in
[docs/release-scorecard.md](release-scorecard.md) clear, and (b) the
[docs/runbook.md](runbook.md) bypass-flip checklist is run.
