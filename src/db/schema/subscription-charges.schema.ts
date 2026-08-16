import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { subscriptionChargeStatusEnum } from './enums';
import { merchants } from './merchants.schema';
import { plans } from './plans.schema';
import { paymentMethods } from './payment-methods.schema';

/** Charge/invoice history for merchant-as-payer — parallel to `transactions` for storefront sales. */
export const subscriptionCharges = pgTable(
  'subscription_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id),
    provider: text('provider').notNull().default('flutterwave'),
    // webhook idempotency key (tx_ref) — same role as transactions.providerReference
    providerReference: text('provider_reference').notNull(),
    // Flutterwave's own numeric transaction id, filled once known, used for verifyTransaction()
    flutterwaveTransactionId: text('flutterwave_transaction_id'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('NGN'),
    status: subscriptionChargeStatusEnum('status').notNull().default('pending'),
    // 1 = first attempt this cycle, 2/3/... = dunning retries
    attemptNumber: integer('attempt_number').notNull().default(1),
    billingPeriodStart: timestamp('billing_period_start', { withTimezone: true }).notNull(),
    billingPeriodEnd: timestamp('billing_period_end', { withTimezone: true }).notNull(),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('subscription_charges_tenant_id_idx').on(table.tenantId),
    providerReferenceIdx: uniqueIndex('subscription_charges_provider_reference_idx').on(
      table.providerReference,
    ),
  }),
);

export type SubscriptionCharge = typeof subscriptionCharges.$inferSelect;
export type NewSubscriptionCharge = typeof subscriptionCharges.$inferInsert;
