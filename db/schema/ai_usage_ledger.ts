import { relations } from 'drizzle-orm';
import {
  bigint,
  index,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { children } from './children.js';
import { aiServiceEnum } from './enums.js';

/**
 * Per-child AI cost ledger. Append-only. Every call to a paid AI service
 * (Whisper, GPT-4o-mini, ElevenLabs, Azure TTS) MUST insert here BEFORE
 * making the call, and the `aiGuard` helper does the cap check in the same
 * transaction. This is the source of truth for the monthly budget cap
 * (acceptance criterion #13).
 *
 * Stored cost in micro-USD (8 decimals would be excessive for the magnitudes
 * involved; numeric(12,6) covers a reasonable range with headroom).
 */
export const aiUsageLedger = pgTable(
  'ai_usage_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    service: aiServiceEnum('service').notNull(),
    // Year-month bucket, e.g. '2026-05'. Indexed for fast "current month" sum.
    yearMonth: text('year_month').notNull(),
    // Tokens (LLM/STT) or characters (TTS) — interpretation depends on service.
    units: bigint('units', { mode: 'number' }).notNull(),
    // Estimated cost in USD with 6-decimal precision.
    costUsd: numeric('cost_usd', { precision: 12, scale: 6 }).notNull(),
    // Was this insert blocked by the cap? 1 = blocked (call NOT made), 0 = allowed.
    blocked: smallint('blocked').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    childMonthIdx: index('ai_usage_child_month_idx').on(t.childId, t.yearMonth),
    childIdx: index('ai_usage_child_idx').on(t.childId),
  }),
);

export const aiUsageLedgerRelations = relations(aiUsageLedger, ({ one }) => ({
  child: one(children, { fields: [aiUsageLedger.childId], references: [children.id] }),
}));

export type AiUsageEntry = typeof aiUsageLedger.$inferSelect;
export type NewAiUsageEntry = typeof aiUsageLedger.$inferInsert;
