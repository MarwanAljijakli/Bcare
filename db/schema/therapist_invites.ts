import { relations } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { children } from './children';
import { therapistGrants } from './therapist_grants';
import { users } from './users';

/**
 * Therapist invite codes. A caregiver issues an invite for a specific child;
 * the code is 12 chars (letters + digits, no ambiguous 0/O/I/l), single-use,
 * and expires 7 days after issue.
 *
 * Acceptance flow:
 *   1. Caregiver creates an invite (POST /api/invites) → row inserted with
 *      `code`, `expires_at = now() + 7 days`, `accepted_at = null`.
 *   2. Caregiver shares the code out-of-band.
 *   3. Therapist visits /accept-invite, enters the code → server validates
 *      (not expired, not accepted, not revoked) and creates a row in
 *      `therapist_grants` linking caregiver + therapist + child.
 *   4. The invite row is marked `accepted_at`, `accepted_by`.
 *
 * Caregiver can revoke an unaccepted invite at any time. Once accepted, the
 * caregiver revokes the *grant* not the invite (the invite is a historical
 * record of how the relationship was created).
 */
export const therapistInvites = pgTable(
  'therapist_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull(),
    caregiverId: uuid('caregiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    codeUniq: uniqueIndex('therapist_invites_code_uniq').on(t.code),
    caregiverIdx: index('therapist_invites_caregiver_idx').on(t.caregiverId),
    childIdx: index('therapist_invites_child_idx').on(t.childId),
  }),
);

export const therapistInvitesRelations = relations(therapistInvites, ({ one, many }) => ({
  caregiver: one(users, { fields: [therapistInvites.caregiverId], references: [users.id] }),
  child: one(children, { fields: [therapistInvites.childId], references: [children.id] }),
  grants: many(therapistGrants),
}));

export type TherapistInvite = typeof therapistInvites.$inferSelect;
export type NewTherapistInvite = typeof therapistInvites.$inferInsert;
