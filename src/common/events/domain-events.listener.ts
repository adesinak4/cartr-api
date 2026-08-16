import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvents,
  MerchantReactivatedEvent,
  MerchantSuspendedEvent,
  OrderConfirmedEvent,
  OrderRefundedEvent,
  PaymentReceivedAfterOrderCancelledEvent,
  SubscriptionActivatedEvent,
  SubscriptionCancelledEvent,
  SubscriptionPastDueEvent,
  SubscriptionRenewedEvent,
} from './domain-events';

/**
 * First real consumer of the in-process event bus — structured audit-style
 * logging of business events, decoupled from whatever triggered them (the
 * webhook handler and AdminService don't need to know this listener exists).
 * Future listeners (notifications, cache invalidation, etc.) register
 * independently here or in their own modules without touching the emitters.
 */
@Injectable()
export class DomainEventsListener {
  private readonly logger = new Logger('DomainEvent');

  @OnEvent(DomainEvents.ORDER_CONFIRMED)
  handleOrderConfirmed(event: OrderConfirmedEvent) {
    this.logger.log(`Order confirmed: ${event.orderId}`, event);
  }

  @OnEvent(DomainEvents.ORDER_REFUNDED)
  handleOrderRefunded(event: OrderRefundedEvent) {
    this.logger.log(`Order refunded: ${event.orderId}`, event);
  }

  @OnEvent(DomainEvents.PAYMENT_RECEIVED_AFTER_ORDER_CANCELLED)
  handlePaymentReceivedAfterOrderCancelled(event: PaymentReceivedAfterOrderCancelledEvent) {
    // error, not warn — real money arrived for an order the system already
    // gave up on. Needs a human decision (refund vs. manual re-confirm).
    this.logger.error(`Payment received for already-cancelled order ${event.orderId}`, event);
  }

  @OnEvent(DomainEvents.MERCHANT_SUSPENDED)
  handleMerchantSuspended(event: MerchantSuspendedEvent) {
    this.logger.log(`Merchant suspended: ${event.slug}`, event);
  }

  @OnEvent(DomainEvents.MERCHANT_REACTIVATED)
  handleMerchantReactivated(event: MerchantReactivatedEvent) {
    this.logger.log(`Merchant reactivated: ${event.slug}`, event);
  }

  @OnEvent(DomainEvents.SUBSCRIPTION_ACTIVATED)
  handleSubscriptionActivated(event: SubscriptionActivatedEvent) {
    this.logger.log(`Subscription activated: ${event.slug}`, event);
  }

  @OnEvent(DomainEvents.SUBSCRIPTION_RENEWED)
  handleSubscriptionRenewed(event: SubscriptionRenewedEvent) {
    this.logger.log(`Subscription renewed: ${event.slug}`, event);
  }

  @OnEvent(DomainEvents.SUBSCRIPTION_PAST_DUE)
  handleSubscriptionPastDue(event: SubscriptionPastDueEvent) {
    this.logger.warn(`Subscription past due: ${event.slug}`, event);
  }

  @OnEvent(DomainEvents.SUBSCRIPTION_CANCELLED)
  handleSubscriptionCancelled(event: SubscriptionCancelledEvent) {
    // error, not warn — this is a hard cutoff, storefront stops serving.
    this.logger.error(`Subscription cancelled (non-payment cutoff): ${event.slug}`, event);
  }
}
