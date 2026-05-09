import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { roleEnum, localeEnum, themeEnum } from './enums.js';
import { users } from './users.js';

/**
 * Caregiver / therapist / admin profile. Children do NOT have a row here —
 * they have a row in `children` linked to their caregiver's user. This keeps
 * the data model honest about who can authenticate.
 */
export const profiles = pgTable('profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(),
  fullName: text('full_name').notNull(),
  preferredLocale: localeEnum('preferred_locale').notNull().default('en'),
  preferredTheme: themeEnum('preferred_theme').notNull().default('light'),
  // Therapist-specific: license number, organization. Stored as JSON so we
  // don't need a separate table for a sparse, rarely-queried payload.
  professionalDetails: jsonb('professional_details').$type<{
    licenseNumber?: string;
    organization?: string;
    specialties?: string[];
  }>(),
  // Caregiver-specific: relationship to child(ren).
  caregiverRelationship: text('caregiver_relationship'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}));

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
