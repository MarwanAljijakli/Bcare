import { relations } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { symbols } from './symbols.js';

/**
 * A symbol library is a named collection of symbols. The seed migration creates
 * one system library per source (ARASAAC EN, ARASAAC AR). Caregivers may have
 * a "Custom" library that holds their own uploads + recorded voices.
 */
export const symbolLibraries = pgTable('symbol_libraries', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  source: text('source', { enum: ['arasaac', 'system', 'custom'] }).notNull(),
  ownerId: uuid('owner_id'),
  // Attribution required for ARASAAC (CC BY-NC-SA). Stored once, displayed
  // wherever symbols from this library are listed.
  attribution: text('attribution'),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const symbolLibrariesRelations = relations(symbolLibraries, ({ many }) => ({
  symbols: many(symbols),
}));

export type SymbolLibrary = typeof symbolLibraries.$inferSelect;
export type NewSymbolLibrary = typeof symbolLibraries.$inferInsert;
