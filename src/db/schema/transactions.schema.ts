import { pgTable, uuid, text, numeric, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { transactionStatusEnum } from './enums';
import { orders } from './orders.schema';
import { merchants } from './merchants.schema';
import { users } from './users.schema';

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // denormalized for tenant-scoped queries without a join to orders
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('flutterwave'),
    // webhook idempotency key — a given provider event must only ever be applied once
    providerReference: text('provider_reference').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    platformFee: numeric('platform_fee', { precision: 12, scale: 2 }).notNull().default('0'),
    merchantAmount: numeric('merchant_amount', { precision: 12, scale: 2 }).notNull(),
    status: transactionStatusEnum('status').notNull().default('pending'),
    // Flutterwave's own numeric transaction id, captured at verification time —
    // distinct from providerReference (our tx_ref/webhook idempotency key).
    // Required to call the refund endpoint; nullable because transactions
    // created before this column existed never captured it.
    flutterwaveTransactionId: text('flutterwave_transaction_id'),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    refundReference: text('refund_reference'),
    refundInitiatedBy: uuid('refund_initiated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orderIdIdx: index('transactions_order_id_idx').on(table.orderId),
    tenantIdIdx: index('transactions_tenant_id_idx').on(table.tenantId),
    providerReferenceIdx: uniqueIndex('transactions_provider_reference_idx').on(
      table.providerReference,
    ),
  }),
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
