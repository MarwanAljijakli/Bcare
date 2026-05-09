import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children.js';
import { inputModalityEnum } from './enums.js';
import { sessions } from './sessions.js';

/**
 * A single input event from the child. Modality determines the shape of
 * `payload`. This table is append-only; never updated.
 *
 * IMPORTANT: payload must NEVER contain raw transcribed text from the child
 * if a caregiver has not consented to AI personalization. Server-side
 * scrubbing happens before insert; we store the symbol IDs and the modality,
 * not the literal speech.
 */
export const inputEvents = pgTable(
  'input_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    modality: inputModalityEnum('modality').notNull(),
    symbolId: uuid('symbol_id'),
    // Latency from intent (focus / hover) to commit, in milliseconds.
    latencyMs: smallint('latency_ms'),
    // Was this selection corrected (undo)? Drives accuracy metrics.
    wasCorrected: smallint('was_corrected').notNull().default(0),
    // Modality-specific. Examples:
    //   symbol  → { tileId, position }
    //   speech  → { confidence, durationMs }   (no transcript)
    //   gesture → { gestureId, confidence }
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Anonymized event id for any third-party logging — never the user id or
    // child id. Generated server-side at insert time.
    anonymousEventId: text('anonymous_event_id').notNull(),
  },
  (t) => ({
    sessionIdx: index('input_events_session_idx').on(t.sessionId),
    childIdx: index('input_events_child_idx').on(t.childId),
    childCreatedIdx: index('input_events_child_created_idx').on(t.childId, t.createdAt),
  }),
);

export const inputEventsRelations = relations(inputEvents, ({ one }) => ({
  session: one(sessions, { fields: [inputEvents.sessionId], references: [sessions.id] }),
  child: one(children, { fields: [inputEvents.childId], references: [children.id] }),
}));

export type InputEvent = typeof inputEvents.$inferSelect;
export type NewInputEvent = typeof inputEvents.$inferInsert;
