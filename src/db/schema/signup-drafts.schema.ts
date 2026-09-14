import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { signupDraftStatusEnum } from './enums';
import { plans } from './plans.schema';
import { themes } from './themes.schema';
import { merchants } from './merchants.schema';

/**
 * The onboarding wizard's in-flight state, from "filled in the form" through
 * to "payment confirmed." No merchant/user row exists until payment actually
 * succeeds (see OnboardingService) — this table is where wizard data lives
 * in the meantime, so an abandoned signup never squats a slug/domain
 * permanently. The row's own id doubles as the Flutterwave tx_ref AND, once
 * `status` is 'completed', as a single-use login token — see
 * OnboardingService.exchangeForLogin.
 */
export const signupDrafts = pgTable('signup_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  // Nullable — a Google-started draft has no password at all; exactly one of
  // passwordHash/googleId is set, enforced in OnboardingService, not the DB.
  passwordHash: text('password_hash'),
  googleId: text('google_id'),
  storeName: text('store_name').notNull(),
  domain: text('domain').notNull(),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id),
  periodMonths: integer('period_months').notNull(),
  themeId: uuid('theme_id').references(() => themes.id),
  status: signupDraftStatusEnum('status').notNull().default('pending'),
  merchantId: uuid('merchant_id').references(() => merchants.id),
  // Set the moment the one-time login token is spent — a completed draft can
  // still be looked up for status display afterward, but never used to
  // issue a second session.
  loginTokenConsumedAt: timestamp('login_token_consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // Cleanup of expired pending drafts isn't automated yet (no scheduled task
  // wired to this field) — flagged as a known follow-up, not a correctness
  // issue: an expired draft just never completes, it doesn't grant anything.
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export type SignupDraft = typeof signupDrafts.$inferSelect;
export type NewSignupDraft = typeof signupDrafts.$inferInsert;
