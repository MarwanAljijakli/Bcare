import { relations } from 'drizzle-orm';
import { date, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { aiUsageLedger } from './ai_usage_ledger.js';
import { localeEnum, themeEnum, vocabularyLevelEnum } from './enums.js';
import { gamificationState } from './gamification_state.js';
import { progressMetrics } from './progress_metrics.js';
import { sessions } from './sessions.js';
import { users } from './users.js';
import { vocabularySets } from './vocabulary_sets.js';

/**
 * Child profile. Always owned by a caregiver `users` row. Therapists may
 * receive read access via an invite code (Module 2) — that grant lives in a
 * separate join table introduced when therapist sharing ships.
 *
 * `sensoryProfile` is JSON because it's a sparse, mostly-read settings blob;
 * we don't query its keys.
 */
export const children = pgTable(
  'children',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caregiverId: uuid('caregiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    preferredName: text('preferred_name'),
    dateOfBirth: date('date_of_birth'),
    preferredLocale: localeEnum('preferred_locale').notNull().default('en'),
    preferredTheme: themeEnum('preferred_theme').notNull().default('light'),
    vocabularyLevel: vocabularyLevelEnum('vocabulary_level').notNull().default('starter'),
    // Voice selection. The catalog of available voices is hard-coded in
    // /shared/voices.ts; we just store the chosen voice id here.
    voiceId: text('voice_id'),
    sensoryProfile: jsonb('sensory_profile')
      .$type<{
        motion: 'full' | 'reduced' | 'off';
        audio: 'full' | 'soft' | 'off';
        contrast: 'standard' | 'high';
        touch: 'standard' | 'large' | 'extra-large';
        fontScale: 1 | 1.25 | 1.5;
      }>()
      .notNull()
      .default({
        motion: 'full',
        audio: 'full',
        contrast: 'standard',
        touch: 'standard',
        fontScale: 1,
      }),
    // Toggles whether AI suggestions auto-apply or require caregiver approval.
    aiSuggestionMode: text('ai_suggestion_mode', { enum: ['auto', 'review'] })
      .notNull()
      .default('review'),
    parentalPinHash: text('parental_pin_hash'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    caregiverIdx: index('children_caregiver_idx').on(t.caregiverId),
  }),
);

export const childrenRelations = relations(children, ({ one, many }) => ({
  caregiver: one(users, { fields: [children.caregiverId], references: [users.id] }),
  sessions: many(sessions),
  vocabularySets: many(vocabularySets),
  gamification: one(gamificationState, {
    fields: [children.id],
    references: [gamificationState.childId],
  }),
  progressMetrics: many(progressMetrics),
  aiUsage: many(aiUsageLedger),
}));

export type Child = typeof children.$inferSelect;
export type NewChild = typeof children.$inferInsert;
