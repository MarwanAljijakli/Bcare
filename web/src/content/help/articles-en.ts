import type { HelpArticle } from './types';

/**
 * English help articles — 12 entries, one per master-plan slug.
 *
 * Authored fresh against BlueCare's actual feature set (modules 2–7).
 * Keep paragraphs short (60–80 words) so each renders cleanly on
 * mobile + screen readers.
 */
export const EN_ARTICLES: HelpArticle[] = [
  {
    slug: 'signing-up',
    locale: 'en',
    title: 'Signing up for BlueCare',
    summary: 'How to create your account, what we ask, and what happens after you sign up.',
    updatedAt: '2026-05-12',
    tags: ['signup', 'account', 'consent', 'magic-link'],
    lead: 'Creating a BlueCare account takes about a minute. You only need a working email — there is no password to remember on signup. We send a magic-link instead, and you click it once to enter the app.',
    sections: [
      {
        heading: 'What we ask for at signup',
        paragraphs: [
          'We ask for three things: your role (parent or therapist), your full name, and your email. Your name is used to greet you on the dashboard and to identify you to therapists you later invite. Your email is the login identifier; nothing is shared with third parties.',
          'We also ask for one explicit consent at signup: that we may process your data to provide the service. That consent is recorded with a timestamp and a version number in our database so you can revoke it later from Settings → Privacy.',
        ],
      },
      {
        heading: 'The magic-link flow',
        paragraphs: [
          'After you submit the signup form, we mail you a link. Clicking the link in your inbox signs you in. The link expires after one hour. If you miss it, request a fresh one from the login page — it will land within 10 seconds.',
          'There is no password to set. If you prefer a password later, you can add one from Settings → Account.',
        ],
      },
      {
        heading: 'What happens after signup',
        paragraphs: [
          "You land on the onboarding wizard — 8 short steps that build your child's board: who they are, their sensory profile, the starting vocabulary level, and the voice they hear when the board speaks. You can return to any step before pressing Finish, and you can edit the entire profile later from Settings → Child.",
        ],
      },
    ],
  },
  {
    slug: 'completing-onboarding',
    locale: 'en',
    title: 'Completing the onboarding wizard',
    summary: 'Walkthrough of the 8 wizard steps and how to come back and edit any of them later.',
    updatedAt: '2026-05-12',
    tags: ['onboarding', 'wizard', 'child', 'sensory', 'vocabulary'],
    lead: "The 8-step onboarding wizard captures everything BlueCare needs to render your child's board. Each step is independent — you can navigate back and forth, and your progress is auto-saved so you can close the tab and resume later.",
    sections: [
      {
        heading: 'The 8 steps',
        paragraphs: [
          'Each step has one focused question. Skipping is allowed only for "About the child"\'s optional fields; everything else is required for the board to render correctly.',
        ],
        list: [
          'Welcome — confirms your account is set up.',
          'About you — confirms your role + locale.',
          'About the child — preferred name, date of birth (used only for age-appropriate symbol selection), notes.',
          'Sensory profile — sound sensitivity, motion preference, autoplay opt-in.',
          'Vocabulary level — starter (40 symbols), expanding, conversational, or advanced.',
          'Voice — picks the voice your child will hear (EN nova or AR Charlotte by default).',
          'Consent — confirms you grant permission for the specific data uses BlueCare needs.',
          'PIN — a 6-digit parental PIN that gates settings + account actions.',
        ],
      },
      {
        heading: 'Editing later',
        paragraphs: [
          'Every wizard answer is editable from Settings. The sensory profile and vocabulary level live under Settings → Child. The voice is under Settings → Voice. The PIN is under Settings → Account. Consent revocation is under Settings → Privacy.',
        ],
      },
    ],
  },
  {
    slug: 'using-the-board-tap-mode',
    locale: 'en',
    title: 'Using the board: tap mode',
    summary:
      'The default AAC board input. How tiles, the sentence strip, Speak, and favorites work together.',
    updatedAt: '2026-05-12',
    tags: ['board', 'tap', 'aac', 'speak', 'favorites'],
    lead: 'The board is a grid of picture tiles. Your child taps a tile to add the word to the sentence strip at the top of the screen, and presses Speak to hear the assembled phrase out loud. Everything else — categories, favorites, the Backspace button — is there to keep the path from intent to spoken sentence as short as possible.',
    sections: [
      {
        heading: 'The sentence strip',
        paragraphs: [
          'The strip above the grid shows the current sentence being built. Tap a token in the strip to remove just that word. Tap Clear (the trash icon) to wipe the whole strip and start over. Tap Speak to hear the assembled phrase via the cloud TTS we selected for your locale.',
        ],
      },
      {
        heading: 'Categories and favorites',
        paragraphs: [
          'The vertical rail on the right (or left in Arabic) groups symbols by category — feelings, food, people, actions. Tap a category to filter the grid to just those tiles.',
          "The favorites bar at the bottom holds the 6 tiles your child uses most. BlueCare updates the bar overnight based on the previous day's board activity — no manual setup.",
        ],
      },
      {
        heading: 'When a tile is missing',
        paragraphs: [
          "If you want a symbol that is not in your child's vocabulary, upload it from Settings → Vocabulary. Uploaded symbols go into a moderation queue and become available within 24 hours after admin approval.",
        ],
      },
    ],
  },
  {
    slug: 'using-the-board-hold-to-speak',
    locale: 'en',
    title: 'Using the board: hold-to-speak (voice input)',
    summary: 'How the microphone button works, when to use it, and what happens to the audio.',
    updatedAt: '2026-05-12',
    tags: ['board', 'voice', 'whisper', 'stt', 'microphone'],
    lead: 'Hold-to-speak is the second board input modality. Your child holds the microphone button, says a word in English or Arabic, and BlueCare picks the matching symbol from their vocabulary and adds it to the sentence strip. It is intended for kids who can speak some words but find typing or tapping tiring.',
    sections: [
      {
        heading: 'Mic permission',
        paragraphs: [
          'On first use, the browser asks for microphone permission. The permission is per-browser and per-device — you may see it again on a new tablet. BlueCare records ONLY while the button is held; the moment you release it, the stream stops.',
          'If the browser blocks the mic (insecure connection, denied permission), the button shows a Mic-off icon. Tap it for guidance on re-enabling.',
        ],
      },
      {
        heading: 'What happens to the audio',
        paragraphs: [
          "When you release the button, the audio clip is sent to OpenAI Whisper for transcription. Whisper returns the recognized text and BlueCare matches it against your child's active vocabulary. The clip is never persisted — it lives in memory for the duration of the request and is dropped after the transcription.",
          'If the recording is shorter than 1 second OR the recognition confidence is very low, BlueCare shows "We couldn\'t hear you clearly" and asks for a retry. This prevents the well-known Whisper hallucination on short silent clips.',
        ],
      },
    ],
  },
  {
    slug: 'using-the-board-gesture-mode',
    locale: 'en',
    title: 'Using the board: gesture mode',
    summary:
      'Opt-in webcam gesture input for kids with reduced touch dexterity. Privacy-by-design.',
    updatedAt: '2026-05-12',
    tags: ['board', 'gesture', 'mediapipe', 'webcam', 'privacy'],
    lead: 'Gesture mode lets your child select tiles with a pinch and navigate categories with a swipe — using the front camera, no contact required. It is OFF by default and only turns on after you explicitly enable it in Settings → Child → Gesture mode.',
    sections: [
      {
        heading: 'Why on-device',
        paragraphs: [
          "Gesture recognition runs locally in the browser using MediaPipe Hands, a small machine-learning model that loads from a CDN once and then runs entirely on your device. Video frames are processed in JavaScript and discarded immediately — no frame ever leaves your child's tablet. BlueCare's servers never receive video.",
          'This is a deliberate design choice. Webcams pointed at children are a sensitive boundary, and the only acceptable answer is that the data stays on the device.',
        ],
      },
      {
        heading: 'Supported gestures',
        paragraphs: [
          'There are two gestures: pinch (thumb + index finger touch) to select the currently-highlighted tile, and swipe left/right to scroll through categories. Highlighting follows the index fingertip across the grid.',
          'The toggle for gesture mode lives in Settings → Child. When OFF the MediaPipe model is not downloaded at all — there is zero bundle cost for families who do not use it.',
        ],
      },
    ],
  },
  {
    slug: 'choosing-a-voice',
    locale: 'en',
    title: 'Choosing a voice',
    summary:
      'How the voice picker works, why EN and AR use different providers, and how to test before saving.',
    updatedAt: '2026-05-12',
    tags: ['voice', 'tts', 'elevenlabs', 'openai', 'nova', 'charlotte'],
    lead: "BlueCare routes English voice through OpenAI's Nova and Arabic voice through ElevenLabs' Charlotte. Both were chosen after a native-speaker acceptance test — Nova sounds the most natural for English, and Charlotte is the most intelligible Saudi-dialect Arabic voice at the moment. You can preview either before saving.",
    sections: [
      {
        heading: 'Why two providers',
        paragraphs: [
          'No single TTS provider is best at both English and Saudi-dialect Arabic. ElevenLabs Multilingual v2 produces dramatically more natural Arabic than any other commercial option we tested, while OpenAI Nova narrowly wins on English clarity for short, child-AAC phrases.',
          'If either provider has an outage, BlueCare automatically falls back to the other one mid-call so your child never hears silence. The fallback is invisible — you only see it on the system health card under Settings if you go looking.',
        ],
      },
      {
        heading: 'The speed slider',
        paragraphs: [
          'Voice speed is a 0.5×–2.0× slider, defaulting to 1.0×. Most caregivers settle in the 0.85×–1.1× range. Slower speeds help younger children process the speech; faster speeds are useful once the child is comfortable.',
          'You can preview at any speed before saving — the preview uses the same cap-counted budget as live board speech, so each preview is metered. The cap resets monthly.',
        ],
      },
    ],
  },
  {
    slug: 'parental-pin',
    locale: 'en',
    title: 'The parental PIN',
    summary: 'What it gates, how it locks out wrong guesses, and how to reset if you forget it.',
    updatedAt: '2026-05-12',
    tags: ['pin', 'parental', 'security', 'settings'],
    lead: 'The parental PIN is a 6-digit code that gates Settings, account export, and account deletion. Your child can use the board freely without ever seeing the PIN — it only appears when someone navigates to a settings page.',
    sections: [
      {
        heading: 'Why 6 digits',
        paragraphs: [
          'Four-digit PINs (10,000 combinations) can be guessed by a determined child or sibling in tens of minutes of trial-and-error. Six digits (1,000,000 combinations) raise the cost of brute-force to days even without the lockout — and with the 3-strike lockout, the practical bar is "impossible without your help".',
        ],
      },
      {
        heading: 'Three wrong tries',
        paragraphs: [
          'Three consecutive wrong PIN entries lock the PIN gate for 30 minutes. The lockout is per-device-browser, so a parent on a phone can still get in even if a child triggered the lockout on the tablet. After 30 minutes the counter resets to zero.',
        ],
      },
      {
        heading: 'If you forget it',
        paragraphs: [
          'You can reset the PIN by clicking "Forgot PIN" on the PIN entry screen. BlueCare emails a one-time reset link to the address on file. Click the link, choose a new 6-digit PIN, and the old one is gone. The reset link expires in 30 minutes for safety.',
        ],
      },
    ],
  },
  {
    slug: 'exporting-your-data',
    locale: 'en',
    title: 'Exporting your data',
    summary:
      'What you get when you press Export, what format it is in, and how long we keep the request.',
    updatedAt: '2026-05-12',
    tags: ['export', 'gdpr', 'pdpl', 'privacy', 'data'],
    lead: 'BlueCare gives you a full machine-readable copy of every piece of data we hold about you and your child, on demand. The export is generated synchronously from the live database and delivered as a JSON file you can save to your device.',
    sections: [
      {
        heading: 'What is in the export',
        paragraphs: [
          'The export covers 14 tables: your profile, every child you onboarded, every board session and the input events inside it, daily progress metrics, gamification state, every consent record, every voice clip you uploaded, your custom vocabulary, every AI cost ledger row, therapist invites and grants, and the onboarding draft.',
        ],
      },
      {
        heading: 'Format and retention',
        paragraphs: [
          'The export is a single JSON document with one key per table. Tables you have no rows for appear as empty arrays. The file is generated on the fly each time you press Export — we do not store a cached copy, and the only record we keep is one audit_log row noting the export happened.',
        ],
      },
      {
        heading: 'Recent-auth requirement',
        paragraphs: [
          'Export requires a sign-in within the last 5 minutes. If your session is older, BlueCare asks you to re-authenticate before proceeding. This protects against a stolen-laptop scenario where someone else clicks Export from a logged-in browser.',
        ],
      },
    ],
  },
  {
    slug: 'deleting-your-account',
    locale: 'en',
    title: 'Deleting your account',
    summary: 'The 30-day grace period, what cascades, and what you can do if you change your mind.',
    updatedAt: '2026-05-12',
    tags: ['delete', 'gdpr', 'pdpl', 'tombstone', 'retention'],
    lead: 'Deleting your account is a two-stage process. Stage one marks your account for deletion (a "tombstone") and immediately blocks login and the board. Stage two — hard deletion — happens automatically 30 days later, deleting every row tied to your account cascade-style. You can cancel during the 30-day window by signing in (the tombstone clears on a successful signin) or by emailing support.',
    sections: [
      {
        heading: 'What gets deleted',
        paragraphs: [
          'Cascade deletion removes: your profile, every child record, every board session and input event, every uploaded custom voice clip and symbol, every progress metric, every gamification row, every personalization suggestion, every therapist invite and grant.',
        ],
      },
      {
        heading: 'What is kept',
        paragraphs: [
          'The audit_log retains a record of the deletion itself: the actor, the timestamp, and the user_id (now orphan). This is a regulatory requirement — auditability of "who did what when" persists even after the user is gone. No PII is retained — the email and name are wiped, only the bare UUID + action remain.',
        ],
      },
      {
        heading: 'Cancelling during the grace period',
        paragraphs: [
          'Sign in within 30 days — the tombstone clears automatically and the account is fully restored. Or email the support address with your account email and we will manually restore it within one business day.',
        ],
      },
    ],
  },
  {
    slug: 'school-staff-workflow',
    locale: 'en',
    title: 'School-staff workflow',
    summary:
      'How a school SLP or teacher gets access to the board, what scope they have, and how the family revokes it.',
    updatedAt: '2026-05-12',
    tags: ['school', 'staff', 'therapist', 'invite', 'caseload'],
    lead: "BlueCare's sharing model is invite-driven. The family generates a 12-character invite code for each staff member who needs access. Staff members redeem the code from their own BlueCare account, and from that point they see a read-mostly view of the child's sessions + the ability to add therapist notes.",
    sections: [
      {
        heading: 'Issuing an invite',
        paragraphs: [
          'From the family dashboard go to Therapist sharing → Issue invite. BlueCare generates a 12-character code (no ambiguous 0/O/I/l) that expires in 7 days and can be used exactly once. You share the code with the staff member out-of-band — email, paper, however you communicate.',
        ],
      },
      {
        heading: 'What staff can do',
        paragraphs: [
          "Staff members can read the child's session history, see vocabulary growth and top symbols, replay any session, and add or edit therapist notes on any session. They cannot edit the vocabulary, change the voice, modify consent records, or invite other staff.",
        ],
      },
      {
        heading: 'Revoking access',
        paragraphs: [
          "Revoke from the same dashboard page that issued the invite. The grant is severed immediately — the staff member's next page-load shows the child gone from their caseload. The audit_log records who revoked and when.",
        ],
      },
    ],
  },
  {
    slug: 'therapist-workflow',
    locale: 'en',
    title: 'Therapist workflow',
    summary: 'Your caseload, the notes editor, and the read-only vocabulary view.',
    updatedAt: '2026-05-12',
    tags: ['therapist', 'caseload', 'notes', 'sessions'],
    lead: 'After you redeem an invite code, the child appears in your caseload at /therapist. The page is a grid of tiles — one per child — showing the caregiver email, the date of the most recent session, and the input count from the last 30 days. Clicking a tile takes you to the read-mostly dashboard view for that child.',
    sections: [
      {
        heading: 'What you see',
        paragraphs: [
          'You see everything the caregiver sees on their own dashboard: the hero stats, today\'s panel, recent sessions, top symbols, vocabulary growth, AI suggestions. The only differences are: an "Editing as therapist" framing on the session-notes editor, no link to Settings (you cannot change the child\'s configuration), and a watermark on the dashboard footer reminding you that you are viewing in a delegated capacity.',
        ],
      },
      {
        heading: 'The notes editor',
        paragraphs: [
          'Open any session from the recent-sessions table. The replay surface shows the assembled phrase, each tap event in order, latency, and the modality icon (tap / voice / gesture). Below the replay is a 4096-character text area for your notes. Save persists to the database immediately and audit-logs the change with your therapist ID.',
        ],
      },
      {
        heading: 'When the family revokes',
        paragraphs: [
          "Family revocations are immediate. Your next request will not see the child in the caseload, and any direct link to that child's dashboard returns 403. Notes you wrote before revocation stay on the session record — they are part of the family's data now.",
        ],
      },
    ],
  },
  {
    slug: 'accessibility-features',
    locale: 'en',
    title: 'Accessibility features',
    summary: 'High-contrast, motion-reduce, screen-reader and keyboard-nav support across the app.',
    updatedAt: '2026-05-12',
    tags: ['accessibility', 'a11y', 'wcag', 'contrast', 'keyboard'],
    lead: 'BlueCare targets WCAG 2.2 AA across the marketing and dashboard surfaces and WCAG 2.2 AAA on the board itself (the surface a child uses). Every interactive control has a visible focus ring, a keyboard activator, and an aria-label.',
    sections: [
      {
        heading: 'Contrast and theme',
        paragraphs: [
          'Theme switches between light, dark, and high-contrast. High-contrast pushes every text-on-background pair to a 7:1 ratio or higher (AAA). The theme picker honors the OS-level prefers-color-scheme by default and persists your choice in localStorage.',
        ],
      },
      {
        heading: 'Motion and animation',
        paragraphs: [
          'Every animated transition (the streak callout, the welcome confetti, dashboard tile fade-ins) respects prefers-reduced-motion. When the OS setting is on, animations either skip the transition entirely or play a single frame at the final state.',
        ],
      },
      {
        heading: 'Screen readers and keyboard',
        paragraphs: [
          'The board is keyboard-navigable: Tab + arrow keys traverse the grid, Space activates a tile, Enter speaks the assembled phrase. Every page has a "Skip to content" link as the first focusable element. Symbol tiles have aria-labels with both EN and AR text so VoiceOver and NVDA announce them correctly regardless of system locale.',
        ],
      },
    ],
  },
];
