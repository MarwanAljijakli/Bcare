# Critical flows

The 12 flows that gate "done" per acceptance criterion #4. Playwright suite
under `web/e2e/` must cover each on Chromium, Firefox, and WebKit.

> Status: **F0 only as of Module 0.** Each subsequent module ships at least
> one new spec covering the flow it introduces.

| #   | Flow                                                                         | Module | Spec                                  |
| --- | ---------------------------------------------------------------------------- | ------ | ------------------------------------- |
| 0   | Bilingual landing renders with no a11y blockers, language toggle works       | 0      | `e2e/smoke.spec.ts`                   |
| 1   | Caregiver signs up, verifies email, lands on onboarding                      | 2      | `e2e/auth-signup.spec.ts`             |
| 2   | Caregiver completes onboarding wizard for a child profile                    | 2      | `e2e/onboarding-child.spec.ts`        |
| 3   | Therapist accepts caregiver invite and views the child's dashboard read-only | 2      | `e2e/therapist-invite.spec.ts`        |
| 4   | Child opens the AAC board, taps a symbol, hears TTS playback                 | 3      | `e2e/board-tap-tts.spec.ts`           |
| 5   | Child uses hold-to-speak; transcript becomes a sentence-strip phrase         | 3      | `e2e/board-speech.spec.ts`            |
| 6   | Child uses webcam pinch gesture to select a symbol                           | 3      | `e2e/board-gesture.spec.ts`           |
| 7   | Caregiver reviews and approves an AI vocabulary suggestion                   | 4      | `e2e/dashboard-ai-review.spec.ts`     |
| 8   | Caregiver uploads a custom symbol with bilingual labels and recorded voice   | 6      | `e2e/dashboard-custom-symbol.spec.ts` |
| 9   | Caregiver exports a 30-day progress PDF                                      | 6      | `e2e/dashboard-export.spec.ts`        |
| 10  | Caregiver toggles "Quiet mode" — board has zero motion and zero sounds       | 3      | `e2e/board-quiet-mode.spec.ts`        |
| 11  | Caregiver requests data export and account deletion (GDPR)                   | 2      | `e2e/account-export-delete.spec.ts`   |
| 12  | Admin moderates a custom symbol from `pending_review` to `active`            | 7      | `e2e/admin-symbol-moderation.spec.ts` |

## RTL parity rule

Every flow above must run with locale `ar` as well as `en`. Playwright
projects fan out via `test.use({ locale: ... })` and base URL prefix.
