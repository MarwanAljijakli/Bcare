import { relations } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children';
import { inputEvents } from './input_events';
import { outputEvents } from './output_events';

/**
 * One AAC session = one continuous use of the board by a child. The session
 * row is opened when the board mounts and closed when it unmounts (or after
 * a 10-minute idle window — handled in the `closeStaleSessions` cron).
 *
 * Therapist notes attach to a session. A session also stores aggregate
 * metrics that drive the dashboard's "today" view without re-aggregating
 * input_events live.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    // Aggregates updated as events stream in.
    inputCount: integer('input_count').notNull().default(0),
    outputCount: integer('output_count').notNull().default(0),
    successfulSelections: integer('successful_selections').notNull().default(0),
    // Therapist notes (markdown-ish plain text, sanitized server-side).
    therapistNotes: text('therapist_notes'),
    // Aggregate metadata snapshot (so dashboards don't re-join everywhere).
    snapshot: jsonb('snapshot')
      .$type<{
        topSymbols?: Array<{ symbolId: string; count: number }>;
        modalityBreakdown?: Record<'symbol' | 'speech' | 'gesture' | 'keyboard', number>;
        sentenceCount?: number;
      }>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    childIdx: index('sessions_child_idx').on(t.childId),
    childStartedAtIdx: index('sessions_child_started_at_idx').on(t.childId, t.startedAt),
  }),
);

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  child: one(children, { fields: [sessions.childId], references: [children.id] }),
  inputs: many(inputEvents),
  outputs: many(outputEvents),
}));

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
