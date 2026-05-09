# Supabase email templates — bilingual (EN + AR)

Five Supabase auth email templates, each in two locales:

| Template                  | EN                       | AR                       |
| ------------------------- | ------------------------ | ------------------------ |
| Confirm signup            | `confirm-signup.en.html` | `confirm-signup.ar.html` |
| Magic link                | `magic-link.en.html`     | `magic-link.ar.html`     |
| Recovery (password reset) | `recovery.en.html`       | `recovery.ar.html`       |
| Invite (therapist)        | `invite.en.html`         | `invite.ar.html`         |
| Email change              | `email-change.en.html`   | `email-change.ar.html`   |

All templates use the brand mark + colors, consistent layout, plain
inline CSS only (no remote stylesheets — they wouldn't load in most
email clients), and the `{{ .ConfirmationURL }}` Supabase variable for
the action link.

## How to install in Supabase

> Supabase doesn't yet support per-locale email templates natively — you
> upload one template per type, and Supabase sends that to every user
> regardless of their preferred locale. The recommended Module 2.B+
> pattern is to make Supabase send the locale that matches the **majority
> audience** as the dashboard default, then override per-user via the
> custom-mailer hook (Module 9 hardening).
>
> For now, paste the **`*.en.html`** templates into the Supabase
> dashboard. The Arabic versions are committed here so they're ready
> when the custom-mailer hook lands. Per-locale dispatch is tracked in
> `docs/known-issues.md` (Module 9 follow-up).

1. Open <https://supabase.com/dashboard/project/ikaaxfhenfbpfjqboixk/auth/templates>.
2. Pick the template type from the tab list (Confirm signup, Magic Link, etc.).
3. Open the matching `*.en.html` file in your editor.
4. **Subject line**: copy the H1 text without the period — e.g. `Confirm your email to finish signup`.
5. **HTML body**: copy the entire file contents into the "Message body (HTML)" field.
6. Click **Save changes**.
7. Repeat for each of the five templates.

After saving, Supabase will use these templates for every auth email it
sends. Test with a real signup at <https://bcare-ten.vercel.app/en/signup>.

## When templates change

- Edit the `.html` files in this folder.
- Commit per the repo's normal flow.
- Re-paste the updated content into the Supabase dashboard.
- Bump `CONSENT_VERSION` in `web/src/lib/auth/consent.ts` only if the
  consent text inside the templates changes — a template-only visual
  refresh shouldn't require a new consent version.

## Module 9 — drop the manual paste step

A custom-mailer hook + per-locale dispatch lands in Module 9 hardening.
At that point this README's "paste manually" step disappears; the
templates here become the single source of truth and the hook reads
them at send-time based on the user's `preferred_locale`.
