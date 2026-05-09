import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { children } from './children';
import { therapistInvites } from './therapist_invites';
import { users } from './users';

/**
 * Active therapist↔child read grants. One row per (therapist, child) pair.
 *
 * Created when a therapist accepts an invite. Read by RLS helper
 * `is_therapist_of(child)` to gate access to sessions / progress / vocabulary
 * / custom voices belonging to a specific child.
 *
 * Revoked by the caregiver at any time — sets `revoked_at` instead of
 * deleting so the audit log retains the relationship. RLS policies that
 * reference this table check `revoked_at IS NULL` to require an active grant.
 */
export const therapistGrants = pgTable(
  'therapist_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caregiverId: uuid('caregiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    therapistId: uuid('therapist_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    inviteId: uuid('invite_id').references(() => therapistInvites.id, {
      onDelete: 'set null',
    }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pairUniq: uniqueIndex('therapist_grants_pair_uniq').on(t.therapistId, t.childId),
    caregiverIdx: index('therapist_grants_caregiver_idx').on(t.caregiverId),
    therapistIdx: index('therapist_grants_therapist_idx').on(t.therapistId),
    childIdx: index('therapist_grants_child_idx').on(t.childId),
  }),
);

export const therapistGrantsRelations = relations(therapistGrants, ({ one }) => ({
  caregiver: one(users, { fields: [therapistGrants.caregiverId], references: [users.id] }),
  therapist: one(users, { fields: [therapistGrants.therapistId], references: [users.id] }),
  child: one(children, { fields: [therapistGrants.childId], references: [children.id] }),
  invite: one(therapistInvites, {
    fields: [therapistGrants.inviteId],
    references: [therapistInvites.id],
  }),
}));

export type TherapistGrant = typeof therapistGrants.$inferSelect;
export type NewTherapistGrant = typeof therapistGrants.$inferInsert;
