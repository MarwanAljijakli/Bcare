import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children.js';
import { outputModalityEnum } from './enums.js';
import { sessions } from './sessions.js';

/**
 * Output event = something the system produced for the child (TTS playback,
 * sentence-strip read-aloud, visual confirmation flash). Append-only.
 */
export const outputEvents = pgTable(
  'output_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    modality: outputModalityEnum('modality').notNull(),
    // For TTS: pointer to cached audio in storage. For sentence-strip: the
    // sequence of symbol ids. For visual-confirmation: nothing.
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    durationMs: smallint('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    anonymousEventId: text('anonymous_event_id').notNull(),
  },
  (t) => ({
    sessionIdx: index('output_events_session_idx').on(t.sessionId),
    childIdx: index('output_events_child_idx').on(t.childId),
  }),
);

export const outputEventsRelations = relations(outputEvents, ({ one }) => ({
  session: one(sessions, { fields: [outputEvents.sessionId], references: [sessions.id] }),
  child: one(children, { fields: [outputEvents.childId], references: [children.id] }),
}));

export type OutputEvent = typeof outputEvents.$inferSelect;
export type NewOutputEvent = typeof outputEvents.$inferInsert;
