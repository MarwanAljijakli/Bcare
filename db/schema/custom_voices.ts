import { relations } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children';
import { localeEnum } from './enums';
import { users } from './users';

/**
 * Caregiver-recorded voice clip used in place of (or alongside) TTS for a
 * specific symbol. Audio is stored in Supabase Storage; this row records the
 * pointer + metadata.
 *
 * Voice clips are private to the owning caregiver/child by default — they
 * are never reused across families.
 */
export const customVoices = pgTable(
  'custom_voices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    recordedById: uuid('recorded_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    symbolId: uuid('symbol_id').notNull(),
    locale: localeEnum('locale').notNull(),
    storagePath: text('storage_path').notNull(),
    durationMs: integer('duration_ms').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    // Optional caregiver-supplied label override (e.g., a nickname).
    labelOverride: text('label_override'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    childIdx: index('custom_voices_child_idx').on(t.childId),
    childSymbolIdx: index('custom_voices_child_symbol_idx').on(t.childId, t.symbolId),
  }),
);

export const customVoicesRelations = relations(customVoices, ({ one }) => ({
  child: one(children, { fields: [customVoices.childId], references: [children.id] }),
  recordedBy: one(users, { fields: [customVoices.recordedById], references: [users.id] }),
}));

export type CustomVoice = typeof customVoices.$inferSelect;
export type NewCustomVoice = typeof customVoices.$inferInsert;
