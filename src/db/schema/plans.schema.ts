import { pgTable, uuid, text, numeric, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  monthlyPrice: numeric('monthly_price', { precision: 12, scale: 2 }).notNull(),
  transactionFeePercent: numeric('transaction_fee_percent', { precision: 5, scale: 2 }).notNull(),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  // Set = retired — excluded from public listing (signup wizard, dashboard
  // plan picker) but left fully intact for merchants already on it and for
  // admin to view/unarchive. Never hard-deleted — plan_prices and merchants
  // both reference it.
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
