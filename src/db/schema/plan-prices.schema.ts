import { pgTable, uuid, integer, numeric, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { plans } from './plans.schema';

// One row per (plan, commitment length) — e.g. Starter x 3 months, Starter x
// 12 months. Total price for the whole period, not a per-month rate: billing
// is a single upfront charge covering the full commitment, not a recurring
// monthly charge multiplied out. See SubscriptionsService for how this is
// actually charged and how the next renewal date is derived from periodMonths.
export const planPrices = pgTable(
  'plan_prices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    periodMonths: integer('period_months').notNull(),
    totalPrice: numeric('total_price', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    planPeriodIdx: uniqueIndex('plan_prices_plan_period_idx').on(table.planId, table.periodMonths),
  }),
);

export type PlanPrice = typeof planPrices.$inferSelect;
export type NewPlanPrice = typeof planPrices.$inferInsert;
