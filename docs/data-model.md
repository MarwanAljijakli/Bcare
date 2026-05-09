# Data model

15 tables. RLS is enabled on every public-schema table; policies live in
[`db/rls/policies.sql`](../db/rls/policies.sql).

## Identity

- **`users`** mirrors `auth.users.id`, `email`, `email_confirmed`. Soft-delete
  via `deleted_at` for GDPR-style data deletion (Module 2).
- **`profiles`** holds caregiver / therapist / admin attributes. One per
  authenticating user. Children do **not** have a row here — see `children`.

## Children

- **`children`** is owned by a caregiver `users` row (`caregiver_id`).
  Holds the child's name, language, theme, vocabulary level, voice
  selection, sensory profile, and AI suggestion mode. Soft-delete.

## Symbols and vocabulary

- **`symbol_libraries`** — system (ARASAAC EN/AR) + per-caregiver custom.
- **`symbols`** — bilingual labels mandatory; status `active` / `pending_review`
  / `rejected` / `archived`. Custom uploads go to admin moderation.
- **`vocabulary_sets`** — per-(child, slot) row; the AI personalization engine
  re-sorts by editing `position` and `frequency` here.

## Sessions and events

- **`sessions`** — one row per board sit-down; ends when board unmounts or
  10-minute idle elapses. Stores aggregate snapshot for fast dashboard reads.
- **`input_events`** — append-only, per modality. **Never stores raw transcripts**.
- **`output_events`** — append-only TTS / sentence-strip / visual feedback.

## Progress, gamification, audit

- **`progress_metrics`** — daily rollup per child; unique on `(child, day)`.
- **`gamification_state`** — streak, daily-capped stars, unlocked tile themes.
  Daily-cap logic lives in the application service.
- **`audit_log`** — append-only RBAC-relevant actions. Admin reads, no one
  edits or deletes via app code.

## Privacy

- **`consent_records`** — caregiver-attested, scoped, versioned. Revocations
  are new rows, never updates.
- **`custom_voices`** — caregiver-recorded clips bound to (child, symbol).
- **`ai_usage_ledger`** — append-only; `aiGuard()` inserts here and blocks
  calls when the per-child monthly cap is reached. This is the cost guard
  that backs acceptance criterion #13.

## Cardinality at a glance

```
users 1───1 profiles
users 1───* children
children 1───* sessions ───* input_events / output_events
children 1───* vocabulary_sets ───1 symbols
children 1───1 gamification_state
children 1───* progress_metrics    (one per day)
children 1───* ai_usage_ledger     (one per AI call)
users 1───* consent_records
users 1───* audit_log              (as actor)
```
