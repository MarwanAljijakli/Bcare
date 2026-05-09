import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { children } from './children.js';
import { consentScopeEnum } from './enums.js';
import { users } from './users.js';

/**
 * Caregiver-attested consent records. One row per (subject, scope, version).
 * `subjectId` may be the caregiver themselves (for caregiver-level consent
 * like analytics) or a child id (for AI personalization, voice recording, or
 * webcam processing on that child).
 *
 * Revocation is modeled as a new row with `granted=false`. We never UPDATE
 * an existing consent row — the historical timeline is the audit trail.
 */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    grantedById: uuid('granted_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    subjectChildId: uuid('subject_child_id').references(() => children.id, {
      onDelete: 'cascade',
    }),
    scope: consentScopeEnum('scope').notNull(),
    granted: boolean('granted').notNull(),
    // Version of the privacy policy / consent text the caregiver attested to.
    policyVersion: text('policy_version').notNull(),
    // Optional free-form context (ip-hash, location string, etc.).
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    grantedByIdx: index('consent_granted_by_idx').on(t.grantedById),
    childScopeIdx: index('consent_child_scope_idx').on(t.subjectChildId, t.scope),
    createdIdx: index('consent_created_idx').on(t.createdAt),
  }),
);

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  grantedBy: one(users, { fields: [consentRecords.grantedById], references: [users.id] }),
  subjectChild: one(children, {
    fields: [consentRecords.subjectChildId],
    references: [children.id],
  }),
}));

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type NewConsentRecord = typeof consentRecords.$inferInsert;
