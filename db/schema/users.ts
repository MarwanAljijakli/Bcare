import { relations } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, boolean } from 'drizzle-orm/pg-core';
import { auditLog } from './audit_log';
import { children } from './children';
import { profiles } from './profiles';

/**
 * Mirror of `auth.users`. Supabase manages the auth.users table; we keep a
 * minimal `public.users` row keyed on the same UUID so foreign keys from our
 * tables don't reach across schemas (which complicates RLS policy authoring).
 *
 * The trigger that copies `auth.users` → `public.users` on signup is defined
 * in `db/rls/triggers.sql` and applied as a migration.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailConfirmed: boolean('email_confirmed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // Soft-delete: data export and deletion (GDPR-style) is required by Module 2.
  // Hard-delete cascades on auth.users are dangerous; we tombstone here first.
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  children: many(children),
  auditEntries: many(auditLog),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
