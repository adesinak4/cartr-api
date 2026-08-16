import { pgEnum } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['owner', 'staff', 'admin']);
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
