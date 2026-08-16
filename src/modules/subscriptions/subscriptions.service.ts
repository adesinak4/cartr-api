import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'node:crypto';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { SubscriptionChargesRepository } from './subscription-charges.repository';
import { MerchantsRepository } from '../merchants/merchants.repository';
import { MerchantsService } from '../merchants/merchants.service';
import { UsersRepository } from '../users/users.repository';
import { PlansService } from '../plans/plans.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { AppConfigService } from '../../config/app-config.service';
import { NotFoundError, PayoutAccountNotReadyError } from '../../common/errors';
import { DomainEvents } from '../../common/events/domain-events';
import {
  FlutterwaveWebhookPayload,
  VerifyTransactionResult,
} from '../flutterwave/flutterwave.types';
import { Merchant, NewMerchant, SubscriptionCharge } from '../../db/schema';

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly paymentMethodsRepository: PaymentMethodsRepository,
    private readonly subscriptionChargesRepository: SubscriptionChargesRepository,
    private readonly merchantsRepository: MerchantsRepository,
    private readonly merchantsService: MerchantsService,
    private readonly usersRepository: UsersRepository,
    private readonly plansService: PlansService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly config: AppConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────── Dashboard-facing ───────────────────────────────

  async getCurrent() {
    const merchant = await this.merchantsService.getCurrent();
    const paymentMethod = await this.paymentMethodsRepository.findActive();
    return {
      subscriptionStatus: merchant.subscriptionStatus,
      trialEndsAt: merchant.trialEndsAt,
      currentPeriodEnd: merchant.currentPeriodEnd,
      nextRenewalAt: merchant.nextRenewalAt,
      pastDueSince: merchant.pastDueSince,
      billingRetryCount: merchant.billingRetryCount,
      planId: merchant.planId,
      pendingPlanId: merchant.pendingPlanId,
      paymentMethod: paymentMethod
        ? { cardLast4: paymentMethod.cardLast4, cardType: paymentMethod.cardType }
        : null,
    };
  }

  /**
   * Same endpoint serves the first charge (trial → active) and self-service
   * recovery from past_due — Flutterwave has no in-place card-update
   * primitive, so "fix payment" always means a brand-new hosted checkout,
   * identical in shape to the very first one. No subaccount split: this is
   * Cartr collecting from the merchant, not a storefront sale.
   */
  async initiateCheckout(redirectUrl: string): Promise<{ paymentLink: string }> {
    const merchant = await this.merchantsService.getCurrent();
    if (!merchant.planId) {
      throw new PayoutAccountNotReadyError('No plan is assigned to this store yet');
    }
    const plan = await this.plansService.getById(merchant.planId);
    const owner = await this.usersRepository.findOwnerByTenantId(merchant.id);
    if (!owner) throw new NotFoundError('Store owner account not found');

    const now = new Date();
    const txRef = crypto.randomUUID();

    await this.subscriptionChargesRepository.insertOne({
      planId: plan.id,
      provider: 'flutterwave',
      providerReference: txRef,
      amount: plan.monthlyPrice,
      currency: 'NGN',
      status: 'pending',
      attemptNumber: 1,
      billingPeriodStart: now,
      billingPeriodEnd: addMonths(now, 1),
    });

    const { paymentLink } = await this.flutterwaveService.initializePayment({
      txRef,
      amount: plan.monthlyPrice,
      currency: 'NGN',
      redirectUrl,
      customer: { name: owner.name, email: owner.email, phonenumber: '' },
      // no subaccountId/platformChargePercent — no split, this charge is entirely Cartr's
    });

    return { paymentLink };
  }

  async changePlan(planId: string): Promise<void> {
    const merchant = await this.merchantsService.getCurrent();
    await this.plansService.getById(planId); // throws NotFoundError if the plan doesn't exist
    // No charge, no proration — applied at the next successful renewal (processDueRenewals).
    await this.merchantsRepository.updateById(merchant.id, { pendingPlanId: planId });
  }

  // ─────────────────────────────── Webhook fallthrough ───────────────────────────────

  /**
   * Called from WebhooksService after an order-transaction lookup for this
   * tx_ref comes up empty. Returns false for a genuinely unknown reference
   * (lets the caller log it as such) or true once handled here (success,
   * failure, or an idempotent no-op) — same shape as
   * TransactionsRepository.findByProviderReference's role in the order flow.
   */
  async handleChargeWebhook(payload: FlutterwaveWebhookPayload): Promise<boolean> {
    const charge = await this.subscriptionChargesRepository.findByProviderReference(
      payload.data.tx_ref,
    );
    if (!charge) return false;

    if (charge.status === 'success') return true; // idempotent no-op

    const verified = await this.flutterwaveService.verifyTransaction(payload.data.id);
    const amountMatches = verified.amount === Number(charge.amount);
    const referenceMatches = verified.txRef === charge.providerReference;

    if (verified.status !== 'successful' || !amountMatches || !referenceMatches) {
      const merchant = await this.merchantsRepository.findById(charge.tenantId);
      if (merchant) await this.recordFailure(merchant, charge, 'Webhook verification failed');
      return true;
    }

    const merchant = await this.merchantsRepository.findById(charge.tenantId);
    if (!merchant) {
      this.logger.error(`Subscription charge ${charge.id} references unknown merchant`);
      return true;
    }

    await this.recordSuccess(merchant, charge, verified);
    return true;
  }

  // ─────────────────────────────── Scheduled renewal ───────────────────────────────

  /** Called on a schedule (see tasks/renew-subscriptions.task.ts). */
  async processDueRenewals(): Promise<{ charged: number; failed: number }> {
    const now = new Date();
    const due = await this.merchantsRepository.findDueForRenewal(now);

    let charged = 0;
    let failed = 0;

    for (const merchant of due) {
      try {
        const didCharge = await this.attemptRenewal(merchant, now);
        if (didCharge) charged++;
        else failed++;
      } catch (err) {
        failed++;
        this.logger.error(`Renewal attempt failed for merchant ${merchant.id}`, err as Error);
      }
    }

    return { charged, failed };
  }

  private async attemptRenewal(merchant: Merchant, now: Date): Promise<boolean> {
    const paymentMethod = await this.paymentMethodsRepository.findActive(merchant.id);

    if (!paymentMethod) {
      // Trial ended with no card added, or a merchant somehow lost their
      // active payment method — either way, nothing to charge. Same dunning
      // path as an explicit charge failure, no charge row created.
      await this.recordFailure(merchant, null, 'No active payment method');
      return false;
    }

    if (!merchant.planId) {
      this.logger.error(`Merchant ${merchant.id} due for renewal has no plan assigned`);
      return false;
    }
    const plan = await this.plansService.getById(merchant.planId);
    const owner = await this.usersRepository.findOwnerByTenantId(merchant.id);
    if (!owner) {
      this.logger.error(`Merchant ${merchant.id} due for renewal has no owner user`);
      return false;
    }

    const txRef = crypto.randomUUID();
    const attemptNumber = merchant.billingRetryCount + 1;

    const charge = await this.subscriptionChargesRepository.createForTenant(
      {
        planId: plan.id,
        provider: 'flutterwave',
        providerReference: txRef,
        amount: plan.monthlyPrice,
        currency: 'NGN',
        status: 'pending',
        attemptNumber,
        billingPeriodStart: now,
        billingPeriodEnd: addMonths(now, 1),
        paymentMethodId: paymentMethod.id,
      },
      merchant.id,
    );

    const result = await this.flutterwaveService.tokenizedCharge({
      token: paymentMethod.providerCardToken,
      amount: plan.monthlyPrice,
      currency: 'NGN',
      email: owner.email,
      txRef,
      narration: `Cartr subscription — ${plan.name}`,
      redirectUrl: '', // off-session charge; no customer present to redirect
    });

    if (result.status === 'successful') {
      const verified = await this.flutterwaveService.verifyTransaction(
        result.flutterwaveTransactionId,
      );
      await this.recordSuccess(merchant, charge, verified);
      return true;
    }

    if (result.status === 'pending') {
      // 3DS challenge in flight — nobody is present to complete it for an
      // off-session renewal. Leave the charge pending; resolves later via
      // the webhook fallthrough (handleChargeWebhook) if the cardholder
      // completes it, or ages out and gets superseded by the next retry.
      // No email infrastructure exists in this codebase yet to notify the
      // merchant — logged clearly as a known gap rather than silently
      // dropped; see README's subscription billing section.
      this.logger.warn(
        `Renewal charge for merchant ${merchant.id} is pending 3DS confirmation — no notification sent (no email infra yet)`,
      );
      return false;
    }

    await this.recordFailure(merchant, charge, 'Tokenized charge failed');
    return false;
  }

  // ─────────────────────────────── Shared outcome handlers ───────────────────────────────

  private async recordSuccess(
    merchant: Merchant,
    charge: SubscriptionCharge,
    verified: VerifyTransactionResult,
  ): Promise<void> {
    const now = new Date();
    const isFirstActivation = merchant.subscriptionStatus === 'trialing';

    if (verified.card) {
      await this.paymentMethodsRepository.replaceActive(
        {
          providerCardToken: verified.card.token,
          cardLast4: verified.card.last4,
          cardType: verified.card.type,
          status: 'active',
        },
        merchant.id, // merchants IS the tenant table — its own id is the tenant id
      );
    }

    const merchantUpdate: Partial<NewMerchant> = {
      subscriptionStatus: 'active',
      pastDueSince: null,
      billingRetryCount: 0,
      currentPeriodEnd: addMonths(now, 1),
      nextRenewalAt: addMonths(now, 1),
    };
    if (merchant.pendingPlanId) {
      merchantUpdate.planId = merchant.pendingPlanId;
      merchantUpdate.pendingPlanId = null;
    }

    await this.subscriptionChargesRepository.recordChargeResult(
      charge.id,
      { status: 'success', flutterwaveTransactionId: verified.flutterwaveTransactionId },
      merchant.id,
      merchantUpdate,
    );

    this.eventEmitter.emit(
      isFirstActivation ? DomainEvents.SUBSCRIPTION_ACTIVATED : DomainEvents.SUBSCRIPTION_RENEWED,
      { merchantId: merchant.id, slug: merchant.slug },
    );
  }

  private async recordFailure(
    merchant: Merchant,
    charge: SubscriptionCharge | null,
    reason: string,
  ): Promise<void> {
    const now = new Date();
    const alreadyPastDue = merchant.subscriptionStatus === 'past_due';
    const pastDueSince = alreadyPastDue ? (merchant.pastDueSince ?? now) : now;
    const billingRetryCount = merchant.billingRetryCount + 1;
    const graceDeadline = addDays(pastDueSince, this.config.subscriptionGracePeriodDays);
    const hardCutoff = now >= graceDeadline;

    const merchantUpdate: Partial<NewMerchant> = hardCutoff
      ? { subscriptionStatus: 'cancelled', billingRetryCount }
      : {
          subscriptionStatus: 'past_due',
          pastDueSince,
          billingRetryCount,
          nextRenewalAt: addDays(now, this.config.subscriptionRenewalRetryIntervalDays),
        };

    if (charge) {
      await this.subscriptionChargesRepository.recordChargeResult(
        charge.id,
        { status: 'failed', failureReason: reason },
        merchant.id,
        merchantUpdate,
      );
    } else {
      await this.merchantsRepository.updateById(merchant.id, merchantUpdate);
    }

    if (hardCutoff) {
      this.eventEmitter.emit(DomainEvents.SUBSCRIPTION_CANCELLED, {
        merchantId: merchant.id,
        slug: merchant.slug,
      });
    } else {
      this.eventEmitter.emit(DomainEvents.SUBSCRIPTION_PAST_DUE, {
        merchantId: merchant.id,
        slug: merchant.slug,
        billingRetryCount,
      });
    }
  }
}
