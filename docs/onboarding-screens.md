# Onboarding screens

> Spec for the caregiver / therapist / admin onboarding flows. Built in
> Module 2. Authored here in advance so design and code can move in lockstep.

## Caregiver onboarding wizard (Module 2)

Goal: minimum-friction path from email-confirmed account to a fully-configured
child profile that can open the board.

| Step | Title (en)          | Title (ar)       | Fields                                                                 | Notes                                       |
| ---- | ------------------- | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| 0    | Welcome             | أهلًا بك         | none                                                                   | Single-screen value-prop reminder + CTA.    |
| 1    | About you           | عنك              | full name, relationship to child, locale, theme                        | Profile row.                                |
| 2    | About your child    | عن طفلك          | name, preferred name, date of birth, language                          | Child row.                                  |
| 3    | Sensory preferences | التفضيلات الحسية | motion, audio, contrast, touch, font scale                             | Default to lowest sensory load if unsure.   |
| 4    | Vocabulary level    | مستوى المفردات   | starter / expanding / conversational / advanced                        | Single-select; sample tile previews.        |
| 5    | Voice               | الصوت            | bilingual voice picker with previews                                   | Stores `voiceId`; cached TTS.               |
| 6    | Consent             | الموافقة         | data processing, AI personalization, voice, webcam (per-scope toggles) | Writes `consent_records`; explicit, scoped. |
| 7    | Done                | تم               | summary card                                                           | CTA → `/board?childId=…`.                   |

Wizard state lives in Zustand; persisted to a draft session row so caregivers
can resume after a network hiccup. Saving each step is independent.

## Therapist onboarding (Module 2)

- Invitation-only via caregiver-generated invite code.
- 3 screens: Validate code → Profile → Confirm scope of access.

## Admin onboarding

- Invite-only by an existing admin via the admin app.
- No self-serve signup. Stored in audit log.

## Rendering rules

- All wizard screens render as a single column, max-width `42rem`, with a
  step indicator at top and a back/next pair at bottom.
- Inputs honor the sensory profile chosen on the user's machine: prefers-
  reduced-motion is detected and applied to the wizard transitions.
- Every step has an explicit "Save and continue later" link.
