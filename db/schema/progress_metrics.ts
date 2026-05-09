import { relations } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { children } from './children';

/**
 * Daily rollup per child. Populated by a nightly job over input_events +
 * output_events. Drives the dashboard's "Progress" view efficiently.
 *
 * One row per (child, day) — the unique constraint enforces it.
 */
export const progressMetrics = pgTable(
  'progress_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    // Vocabulary growth — symbols used at least once on this day.
    activeVocabularySize: integer('active_vocabulary_size').notNull().default(0),
    // Communication volume.
    inputCount: integer('input_count').notNull().default(0),
    outputCount: integer('output_count').notNull().default(0),
    // Average sentence length (in symbols), to 2 decimals.
    avgSentenceLength: numeric('avg_sentence_length', { precision: 5, scale: 2 })
      .notNull()
      .default('0'),
    successRate: numeric('success_rate', { precision: 4, scale: 3 }).notNull().default('0'),
    // Modality distribution snapshot.
    modalityBreakdown: jsonb('modality_breakdown')
      .$type<Record<'symbol' | 'speech' | 'gesture' | 'keyboard', number>>()
      .notNull()
      .default({ symbol: 0, speech: 0, gesture: 0, keyboard: 0 }),
    // Top symbols of the day (cap 10), denormalized for fast read.
    topSymbols: jsonb('top_symbols')
      .$type<Array<{ symbolId: string; count: number }>>()
      .notNull()
      .default([]),
  },
  (t) => ({
    childDayUniq: uniqueIndex('progress_metrics_child_day_uniq').on(t.childId, t.day),
    childIdx: index('progress_metrics_child_idx').on(t.childId),
  }),
);

export const progressMetricsRelations = relations(progressMetrics, ({ one }) => ({
  child: one(children, { fields: [progressMetrics.childId], references: [children.id] }),
}));

export type ProgressMetric = typeof progressMetrics.$inferSelect;
export type NewProgressMetric = typeof progressMetrics.$inferInsert;
