import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { paymentMethodStatusEnum } from './enums';
import { merchants } from './merchants.schema';

/**
 * The merchant as PAYER — their own saved card for Cartr subscription
 * charges. Distinct from `payment_accounts`, which is the merchant as PAYEE
 * (their Flutterwave subaccount for receiving storefront sales).
 *
 * Multiple rows are kept per tenant deliberately (history survives a card
 * replacement) — unlike `payment_accounts`, this is NOT a true one-per-tenant
 * table, so there's no unique index on tenantId. Only one row should be
 * `active` at a time; that invariant is enforced in the repository method
 * that inserts a replacement (mark the old row `replaced` in the same
 * transaction as inserting the new one), not via a DB constraint.
 */
export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('flutterwave'),
    providerCardToken: text('provider_card_token').notNull(),
    cardLast4: text('card_last4').notNull(),
    cardType: text('card_type').notNull(),
    status: paymentMethodStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('payment_methods_tenant_id_idx').on(table.tenantId),
  }),
);

export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type NewPaymentMethod = typeof paymentMethods.$inferInsert;
