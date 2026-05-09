import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Draft state for the caregiver onboarding wizard. One row per user — the
 * primary key is `user_id` so "save and continue later" is a single
 * upsert, never an "is this the most recent draft?" query.
 *
 * `payload` holds whatever the wizard has captured so far, partial:
 *   {
 *     profile?: { fullName, relationship, locale, theme },
 *     child?: { fullName, preferredName, dob, language, vocabularyLevel,
 *               sensoryProfile, voiceId },
 *     consentScopes?: { dataProcessing, aiPersonalization, voiceCapture,
 *                       webcamGesture, analytics },
 *     pin?: { hash } // bcrypt hash; never the plaintext PIN
 *   }
 *
 * `step` tracks which step the user is currently on so resume drops them
 * back at the same place — values match the keys in `docs/onboarding-screens.md`.
 *
 * On final submit, the wizard reads the row, writes the canonical
 * `profiles` + `children` + `consent_records` rows, and deletes the draft.
 */
export const draftOnboarding = pgTable('draft_onboarding', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  step: text('step', {
    enum: [
      'welcome',
      'about_you',
      'about_child',
      'sensory',
      'vocabulary_level',
      'voice',
      'consent',
      'pin',
      'review',
    ],
  })
    .notNull()
    .default('welcome'),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const draftOnboardingRelations = relations(draftOnboarding, ({ one }) => ({
  user: one(users, { fields: [draftOnboarding.userId], references: [users.id] }),
}));

export type DraftOnboarding = typeof draftOnboarding.$inferSelect;
export type NewDraftOnboarding = typeof draftOnboarding.$inferInsert;
