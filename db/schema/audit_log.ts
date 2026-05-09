import { relations } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { auditActionEnum } from './enums.js';
import { users } from './users.js';

/**
 * Append-only audit trail. RBAC-relevant actions (sign-in, profile changes,
 * data export, admin moderation) are written here. Admin role can read; no
 * one (including admin) can update or delete via app code — RLS denies it.
 *
 * Note: `actorId` may be null for unauthenticated actions (e.g., failed
 * sign-in attempts). `targetType` + `targetId` describe the affected entity.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: auditActionEnum('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    // Network context — IP and UA hashed (not raw) to balance forensics with
    // data minimization. Hashing is done in the request handler before insert.
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    actorIdx: index('audit_actor_idx').on(t.actorId),
    actionIdx: index('audit_action_idx').on(t.action),
    createdIdx: index('audit_created_idx').on(t.createdAt),
  }),
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}));

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
