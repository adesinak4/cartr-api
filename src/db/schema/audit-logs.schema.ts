import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * Append-only record of admin actions — who did what, to which entity, when.
 * Never updated after insert. `actorId` is nullable only for the rare case
 * an action fires with no resolvable acting user (should not happen for any
 * admin-gated route in practice, but the column isn't worth a NOT NULL that
 * could ever block a real write).
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // e.g. 'merchant.suspended', 'plan.price_updated', 'order.refunded'
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    actorId: uuid('actor_id').references(() => users.id),
    actorRole: text('actor_role'),
    // Free-form context — old/new values, refund amount, whatever the call
    // site finds useful. Never store secrets/tokens here.
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    actorIdx: index('audit_logs_actor_idx').on(table.actorId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
