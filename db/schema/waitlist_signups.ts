import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { localeEnum } from './enums';

/**
 * Marketing-site waitlist. Captured pre-launch from the /pricing Early Access
 * page. Admin-only read; insert is allowed unauthenticated (bot mitigation
 * lives in the route handler — rate limit + zod + email-format strictness).
 *
 * No PII beyond email + role + locale + a free-form `referrer` source. This
 * intentionally never joins to a child profile or any other table.
 */
export const waitlistSignups = pgTable(
  'waitlist_signups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    role: text('role', { enum: ['family', 'therapist', 'school', 'other'] })
      .notNull()
      .default('family'),
    locale: localeEnum('locale').notNull().default('en'),
    // Optional free-form context — UTM source, referrer hostname, "told by friend".
    source: text('source'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUniq: uniqueIndex('waitlist_email_uniq').on(t.email),
    createdIdx: index('waitlist_created_idx').on(t.createdAt),
    roleIdx: index('waitlist_role_idx').on(t.role),
  }),
);

export type WaitlistSignup = typeof waitlistSignups.$inferSelect;
export type NewWaitlistSignup = typeof waitlistSignups.$inferInsert;
