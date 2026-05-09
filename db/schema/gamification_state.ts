import { relations } from 'drizzle-orm';
import { date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children.js';

/**
 * Per-child gamification state. Calm streaks, capped daily stars, palette-safe
 * unlocked themes. NO leaderboards, NO time pressure.
 *
 * Daily-cap of 5 stars/day enforced in the application service, validated in
 * unit tests. The hard count of stars and the streak are stored here so the
 * UI doesn't have to recompute over events on every render.
 */
export const gamificationState = pgTable('gamification_state', {
  childId: uuid('child_id')
    .primaryKey()
    .references(() => children.id, { onDelete: 'cascade' }),
  // Lifetime stars and the streak.
  totalStars: integer('total_stars').notNull().default(0),
  currentStreakDays: integer('current_streak_days').notNull().default(0),
  longestStreakDays: integer('longest_streak_days').notNull().default(0),
  // Per-day cap accounting.
  starsAwardedToday: integer('stars_awarded_today').notNull().default(0),
  starsAwardedDay: date('stars_awarded_day'),
  // Unlocked tile theme packs ('animal', 'nature', 'space', 'ocean').
  unlockedThemes: jsonb('unlocked_themes').$type<string[]>().notNull().default([]),
  selectedTheme: text('selected_theme'),
  // Last-celebration tick — used to debounce repeated celebrations.
  lastCelebrationAt: timestamp('last_celebration_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gamificationStateRelations = relations(gamificationState, ({ one }) => ({
  child: one(children, { fields: [gamificationState.childId], references: [children.id] }),
}));

export type GamificationState = typeof gamificationState.$inferSelect;
export type NewGamificationState = typeof gamificationState.$inferInsert;
