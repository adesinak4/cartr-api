import { pgTable, uuid, text, boolean, integer, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { merchantAccountStatusEnum, subscriptionStatusEnum } from './enums';
import { plans } from './plans.schema';
import { themes } from './themes.schema';

export const merchants = pgTable(
  'merchants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    storeName: text('store_name').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'),
    address: text('address'),
    currency: text('currency').notNull().default('NGN'),
    isOpen: boolean('is_open').notNull().default(true),
    accountStatus: merchantAccountStatusEnum('account_status').notNull().default('active'),
    subscriptionStatus: subscriptionStatusEnum('subscription_status').notNull().default('trialing'),
    pastDueSince: timestamp('past_due_since', { withTimezone: true }),
    planId: uuid('plan_id').references(() => plans.id),
    themeId: uuid('theme_id').references(() => themes.id),
    customDomain: text('custom_domain'),
    customDomainVerified: boolean('custom_domain_verified').notNull().default(false),
    customDomainVerificationToken: text('custom_domain_verification_token'),
    // Anchors both the background cron's pending-query window and the
    // per-merchant retry timeout — set whenever verification is (re)initiated.
    customDomainRequestedAt: timestamp('custom_domain_requested_at', { withTimezone: true }),

    // Subscription billing
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    // Doubles as "next dunning retry due at" while subscriptionStatus is
    // past_due — one field the renewal cron always trusts, rather than two
    // fields (next renewal vs. next retry) that could drift out of sync.
    nextRenewalAt: timestamp('next_renewal_at', { withTimezone: true }),
    // Resets to 0 on any successful charge.
    billingRetryCount: integer('billing_retry_count').notNull().default(0),
    // Set on a plan change request; applied at the next successful renewal —
    // no proration, change takes effect next cycle only.
    pendingPlanId: uuid('pending_plan_id').references(() => plans.id),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('merchants_slug_idx').on(table.slug),
    customDomainIdx: uniqueIndex('merchants_custom_domain_idx').on(table.customDomain),
  }),
);

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
