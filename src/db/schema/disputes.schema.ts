import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { disputeStatusEnum } from './enums';
import { orders } from './orders.schema';
import { merchants } from './merchants.schema';
import { users } from './users.schema';

/**
 * Manually logged — support/admin creates one when a customer or merchant
 * reaches out about an order. No automated provider chargeback intake yet
 * (Flutterwave sends its own dispute webhook events; wiring that up is a
 * separate, deferred integration — see the dispute-management discussion).
 */
export const disputes = pgTable('disputes', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  // Denormalized for admin filtering without a join, same pattern as transactions.tenantId.
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  status: disputeStatusEnum('status').notNull().default('open'),
  resolutionNotes: text('resolution_notes'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export type Dispute = typeof disputes.$inferSelect;
export type NewDispute = typeof disputes.$inferInsert;
