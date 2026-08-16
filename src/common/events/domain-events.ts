/**
 * In-process domain events (Node's EventEmitter2 via @nestjs/event-emitter —
 * NOT a message broker). Purpose: let side effects of a state transition
 * live in their own listener instead of being piled into the service method
 * that caused the transition. Everything here stays synchronous and within
 * this one process — see the architecture note in README.md for why a real
 * broker isn't warranted yet.
 *
 * Event names are centralized here so emitters and listeners can't drift
 * apart on a typo'd string, and so payload shape is typed on both ends.
 */

export const DomainEvents = {
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_REFUNDED: 'order.refunded',
  PAYMENT_RECEIVED_AFTER_ORDER_CANCELLED: 'order.payment_received_after_cancelled',
  MERCHANT_SUSPENDED: 'merchant.suspended',
  MERCHANT_REACTIVATED: 'merchant.reactivated',
  SUBSCRIPTION_ACTIVATED: 'subscription.activated',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_PAST_DUE: 'subscription.past_due',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
} as const;

export interface OrderConfirmedEvent {
  orderId: string;
  tenantId: string;
  transactionId: string;
  total: string;
}

/** Admin-initiated, full refund of a completed order — see OrdersService.refundOrder. */
export interface OrderRefundedEvent {
  orderId: string;
  tenantId: string;
  transactionId: string;
  total: string;
  refundReference: string;
}

/**
 * Fired when a webhook reports successful payment for an order that's no
 * longer 'pending' — almost always because the reservation-expiry task
 * cancelled it (and released its stock, possibly to another buyer) just
 * before the payment confirmation arrived. The transaction is still marked
 * 'success' — money genuinely arrived and that fact must not be lost — but
 * the order itself is deliberately left alone rather than guessed at. This
 * needs a human: refund, manual re-confirmation if stock allows, whatever
 * fits the specific case. Not something to automate past.
 */
export interface PaymentReceivedAfterOrderCancelledEvent {
  orderId: string;
  tenantId: string;
  transactionId: string;
  total: string;
}

export interface MerchantSuspendedEvent {
  merchantId: string;
  slug: string;
}

export interface MerchantReactivatedEvent {
  merchantId: string;
  slug: string;
}

export interface SubscriptionActivatedEvent {
  merchantId: string;
  slug: string;
}

export interface SubscriptionRenewedEvent {
  merchantId: string;
  slug: string;
}

export interface SubscriptionPastDueEvent {
  merchantId: string;
  slug: string;
  billingRetryCount: number;
}

/** Hard cutoff for non-payment — storefront stops serving from this point (see TenantContextMiddleware). */
export interface SubscriptionCancelledEvent {
  merchantId: string;
  slug: string;
}
