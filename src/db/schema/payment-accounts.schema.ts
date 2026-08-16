import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { kycStatusEnum } from './enums';
import { merchants } from './merchants.schema';

export const paymentAccounts = pgTable(
  'payment_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('flutterwave'),
    providerSubaccountId: text('provider_subaccount_id'),
    bankName: text('bank_name').notNull(),
    // Flutterwave's create-subaccount API wants an ISO bank code (e.g. "044"),
    // not the free-text bank name — see FlutterwaveService.listBanks().
    bankCode: text('bank_code').notNull(),
    accountNumber: text('account_number').notNull(),
    accountName: text('account_name').notNull(),
    kycStatus: kycStatusEnum('kyc_status').notNull().default('pending'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // one payout account per merchant
    tenantIdIdx: uniqueIndex('payment_accounts_tenant_id_idx').on(table.tenantId),
  }),
);

export type PaymentAccount = typeof paymentAccounts.$inferSelect;
export type NewPaymentAccount = typeof paymentAccounts.$inferInsert;
