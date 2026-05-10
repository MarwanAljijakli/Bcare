import { relations } from 'drizzle-orm';
import { index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children';
import { symbols } from './symbols';
import { users } from './users';

/**
 * Vocabulary suggestions — caregiver-reviewable proposals from the
 * personalization engine.
 *
 * Module 4 lands two suggestion sources, both written through this
 * table:
 *
 *   • `frequency` — the free-first source. Looks at last-30-day usage
 *     of symbols that already exist on the child's board, and proposes
 *     adding *related* symbols from the same categories that the child
 *     hasn't seen yet. No LLM. No upstream API. No cost.
 *
 *   • `llm` — an OPTIONAL upgrade. Only generated when the caregiver has
 *     explicitly enabled the LLM toggle AND OPENAI_API_KEY is set on
 *     the deployment. Calls GPT-4o-mini through aiGuard with the same
 *     monthly per-child cap. If the cap is reached, frequency
 *     suggestions still flow.
 *
 * Workflow:
 *   1. Cron generates suggestions overnight → status='pending'.
 *   2. Caregiver opens /dashboard/personalization → sees pending list.
 *   3. Caregiver taps Approve → row stamped status='approved' +
 *      `vocabulary_sets` row inserted for the child.
 *   4. Caregiver taps Reject → row stamped status='rejected' with a
 *      reason; the symbol won't be suggested again for 60 days
 *      (enforced by the cron via a `not exists` check).
 *
 * The audit_log captures every approve/reject (action='admin_action'
 * with metadata.kind='vocab_suggestion_*'). Suggestions older than 30
 * days that were never reviewed are auto-expired by the cron.
 */
export const suggestionStatusEnum = pgEnum('suggestion_status', [
  'pending',
  'approved',
  'rejected',
  'expired',
]);

export const suggestionSourceEnum = pgEnum('suggestion_source', ['frequency', 'llm']);

export const vocabularySuggestions = pgTable(
  'vocabulary_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id, { onDelete: 'cascade' }),
    source: suggestionSourceEnum('source').notNull(),
    /** Score from 0..1 — higher = stronger candidate. Drives default sort. */
    score: numeric('score', { precision: 4, scale: 3 }).notNull().default('0'),
    reason: text('reason'),
    /** Raw signals the engine used (frequency in nearby category,
     *  time-of-day match, etc). Useful for explainable suggestions. */
    signals: jsonb('signals').$type<Record<string, unknown>>().notNull().default({}),
    status: suggestionStatusEnum('status').notNull().default('pending'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedById: uuid('reviewed_by_id').references(() => users.id, { onDelete: 'set null' }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    childStatusIdx: index('vocab_suggestions_child_status_idx').on(t.childId, t.status),
    childSymbolIdx: index('vocab_suggestions_child_symbol_idx').on(t.childId, t.symbolId),
    expiresIdx: index('vocab_suggestions_expires_idx').on(t.expiresAt),
  }),
);

export const vocabularySuggestionsRelations = relations(vocabularySuggestions, ({ one }) => ({
  child: one(children, { fields: [vocabularySuggestions.childId], references: [children.id] }),
  symbol: one(symbols, { fields: [vocabularySuggestions.symbolId], references: [symbols.id] }),
  reviewedBy: one(users, {
    fields: [vocabularySuggestions.reviewedById],
    references: [users.id],
  }),
}));

export type VocabularySuggestion = typeof vocabularySuggestions.$inferSelect;
export type NewVocabularySuggestion = typeof vocabularySuggestions.$inferInsert;
