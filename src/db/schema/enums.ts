import { pgEnum } from 'drizzle-orm/pg-core';

// 'support' is a platform-level tier alongside 'admin' — narrower permissions
// (read/list + disputes, no suspend/refund/price-changes/settings). See
// RolesGuard usages for exactly which endpoints allow it.
export const userRoleEnum = pgEnum('user_role', ['owner', 'staff', 'admin', 'support']);
export const userStatusEnum = pgEnum('user_status', ['active', 'invited', 'disabled']);

export const merchantAccountStatusEnum = pgEnum('merchant_account_status', ['active', 'suspended']);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'trialing',
  'active',
  'past_due',
  'cancelled',
]);

export const productStatusEnum = pgEnum('product_status', ['active', 'draft', 'archived']);

export const orderStatusEnum = pgEnum('order_status', [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const kycStatusEnum = pgEnum('kyc_status', ['pending', 'verified', 'rejected']);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'success',
  'failed',
  'refunded',
]);

export const subscriptionChargeStatusEnum = pgEnum('subscription_charge_status', [
  'pending', // charge fired, awaiting result (includes a 3DS challenge in flight)
  'success',
  'failed',
]);

export const paymentMethodStatusEnum = pgEnum('payment_method_status', [
  'active',
  'failed', // last charge on this token failed / token presumed dead
  'replaced', // superseded by a newer payment method row
]);

export const signupDraftStatusEnum = pgEnum('signup_draft_status', [
  'pending', // checkout initiated, payment not yet confirmed
  'completed', // payment confirmed, merchant + owner created
  'failed', // payment failed/expired — never became a real account
]);

export const domainProvisioningStatusEnum = pgEnum('domain_provisioning_status', [
  'pending', // waiting on ops to manually register + point DNS (see Truehost discussion)
  'done',
]);

// Manual dispute tracking only — no automated provider chargeback intake
// (that's a separate, deferred integration). See the dispute-management discussion.
export const disputeStatusEnum = pgEnum('dispute_status', ['open', 'resolved']);
