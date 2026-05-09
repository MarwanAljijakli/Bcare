import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { symbolStatusEnum } from './enums.js';
import { symbolLibraries } from './symbol_libraries.js';

/**
 * One symbol/pictogram. Bilingual labels are stored together — both must be
 * present for an active system symbol. Categories like 'food', 'feelings',
 * 'people' are stored on the symbol so fast filtering on the board doesn't
 * need a join.
 *
 * Custom symbols start in `pending_review` and require admin moderation
 * before moving to `active`.
 */
export const symbols = pgTable(
  'symbols',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    libraryId: uuid('library_id')
      .notNull()
      .references(() => symbolLibraries.id, { onDelete: 'cascade' }),
    // Bilingual labels.
    labelEn: text('label_en').notNull(),
    labelAr: text('label_ar').notNull(),
    // Optional phonetic helper text shown on the child surface.
    phoneticEn: text('phonetic_en'),
    phoneticAr: text('phonetic_ar'),
    // Storage path or external URL; resolved by the symbol resolver.
    imagePath: text('image_path').notNull(),
    // Category slugs ('food', 'feelings', 'people'). Multiple allowed.
    categories: jsonb('categories').$type<string[]>().notNull().default([]),
    // Tags (free-form). Used by the AI suggestion service.
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    // Frequency hint — global usage popularity. Updated by a nightly job.
    globalFrequency: integer('global_frequency').notNull().default(0),
    status: symbolStatusEnum('status').notNull().default('active'),
    // Audit / moderation
    submittedBy: uuid('submitted_by'),
    moderatedBy: uuid('moderated_by'),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    libraryIdx: index('symbols_library_idx').on(t.libraryId),
    statusIdx: index('symbols_status_idx').on(t.status),
  }),
);

export const symbolsRelations = relations(symbols, ({ one }) => ({
  library: one(symbolLibraries, {
    fields: [symbols.libraryId],
    references: [symbolLibraries.id],
  }),
}));

export type Symbol = typeof symbols.$inferSelect;
export type NewSymbol = typeof symbols.$inferInsert;
