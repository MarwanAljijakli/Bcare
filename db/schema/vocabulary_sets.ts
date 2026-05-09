import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children.js';

/**
 * A child's active vocabulary set — the set of symbols currently visible on
 * their board, plus per-symbol layout metadata (position, frequency, last-used).
 * One row per (child, slot) for efficient grid recomputation by the
 * personalization engine.
 */
export const vocabularySets = pgTable(
  'vocabulary_sets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    symbolId: uuid('symbol_id').notNull(),
    // Position on the grid. Re-sorted by the personalization engine.
    position: integer('position').notNull(),
    category: text('category'),
    frequency: integer('frequency').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    isFavorite: integer('is_favorite').notNull().default(0),
    // Personalization metadata — confidence score, last suggestion source, etc.
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    childIdx: index('vocab_child_idx').on(t.childId),
    childPositionIdx: index('vocab_child_position_idx').on(t.childId, t.position),
    childFrequencyIdx: index('vocab_child_frequency_idx').on(t.childId, t.frequency),
  }),
);

export const vocabularySetsRelations = relations(vocabularySets, ({ one }) => ({
  child: one(children, { fields: [vocabularySets.childId], references: [children.id] }),
}));

export type VocabularySet = typeof vocabularySets.$inferSelect;
export type NewVocabularySet = typeof vocabularySets.$inferInsert;
