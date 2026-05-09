import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { localeEnum } from './enums';

/**
 * @deprecated Module 1.5 (2026-05-09) made BlueCare free + open from day one;
 * the /pricing surface and the waitlist UI are gone. This table and the
 * /api/waitlist route handler are retained read-only so any in-flight
 * signups already deployed don't hit a missing endpoint. **No new traffic
 * reaches this surface.** Schedule for full removal in Module 9 hardening
 * (see docs/backlog.md).
 *
 * Legacy purpose: marketing-site waitlist captured pre-launch. Admin-only
 * read; insert allowed unauthenticated (bot mitigation in the route handler
 * — rate limit + zod + email-format strictness).
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
