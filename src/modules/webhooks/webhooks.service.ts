import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppConfigService } from '../../config/app-config.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { TransactionsService } from '../transactions/transactions.service';
import { OrdersService } from '../orders/orders.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { verifyWebhookSignature } from '../flutterwave/flutterwave-webhook.util';
import { FlutterwaveWebhookPayload } from '../flutterwave/flutterwave.types';
import { TenantContext } from '../../common/tenant/tenant-context';
import { UnauthorizedError, ValidationError } from '../../common/errors';
import { DomainEvents } from '../../common/events/domain-events';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly transactionsService: TransactionsService,
    private readonly ordersService: OrdersService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async handleFlutterwaveEvent(
    signatureHeader: string | undefined,
    payload: FlutterwaveWebhookPayload,
  ): Promise<{ status: string }> {
    if (!verifyWebhookSignature(signatureHeader, this.config.flutterwaveWebhookSecretHash)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    // Only the fields this handler actually needs are validated — deliberately
    // not run through a strict class-validator DTO, since Flutterwave's real
    // payload has many more fields than we care about and the app's global
    // ValidationPipe is whitelist-strict (would reject anything we didn't
    // explicitly declare).
    if (!payload?.event || !payload?.data?.tx_ref || !payload?.data?.id) {
      throw new ValidationError('Malformed webhook payload');
    }

    if (payload.event !== 'charge.completed') {
      this.logger.log(`Ignoring unhandled webhook event type: ${payload.event}`);
      return { status: 'ignored' };
    }

    const transaction = await this.transactionsService.findByProviderReference(payload.data.tx_ref);

    if (!transaction) {
      // Not an order payment — check subscription charges before giving up.
      // Same webhook/verif-hash mechanism serves both charge types; there's
      // no separate event type to branch on upfront.
      const handledAsSubscription = await this.subscriptionsService.handleChargeWebhook(payload);
      if (handledAsSubscription) {
        return { status: 'confirmed' };
      }

      // Don't 500 — an unrecognized tx_ref shouldn't trigger Flutterwave's
      // webhook retry storm. Log it; it's either a stale/foreign reference
      // or a real bug worth investigating separately.
      this.logger.warn(`Webhook for unknown transaction reference: ${payload.data.tx_ref}`);
      return { status: 'unknown_reference' };
    }

    if (transaction.status === 'success') {
      // Idempotent no-op — Flutterwave may deliver the same event more than once.
      return { status: 'already_processed' };
    }

    // Defense-in-depth: the verif-hash check above is a shared-secret bearer
    // check, not a cryptographic signature over the payload — it doesn't
    // prove the amount/currency in this specific payload weren't tampered
    // with. Always re-confirm against Flutterwave directly before marking
    // real money as settled.
    const verified = await this.flutterwaveService.verifyTransaction(payload.data.id);

    const amountMatches = verified.amount === Number(transaction.amount);
    const referenceMatches = verified.txRef === transaction.providerReference;

    if (verified.status !== 'successful' || !amountMatches || !referenceMatches) {
      await this.transactionsService.markFailed(transaction.id);

      // Payment definitively failed — release the stock this order was
      // holding rather than leaving it reserved until the expiry task gets
      // to it, and cancel the order so it doesn't sit in 'pending' looking
      // like a live checkout.
      await TenantContext.run({ tenantId: transaction.tenantId, userId: null, role: null }, () =>
        this.ordersService.releaseReservation(transaction.orderId),
      );

      this.logger.warn(
        `Transaction ${transaction.id} verification mismatch or failure — marked failed, reservation released`,
      );
      return { status: 'verification_failed' };
    }

    // No TenantContext needed here — markSuccessAndConfirmOrder is fully
    // unscoped (every row it touches is already a specific, known id).
    const confirmed = await this.transactionsService.markSuccessAndConfirmOrder(
      transaction.id,
      transaction.orderId,
      verified.flutterwaveTransactionId,
    );

    if (!confirmed) {
      // The order was no longer 'pending' by the time this ran — almost
      // certainly the reservation-expiry task cancelled it (and released its
      // stock, possibly to another buyer) moments before this webhook
      // arrived. The transaction is still marked 'success' above — money
      // genuinely arrived and that must not be lost — but the order itself
      // is deliberately left alone. This needs a human, not more automation.
      this.logger.error(
        `Payment confirmed for order ${transaction.orderId} but it was no longer pending — needs manual review`,
      );
      this.eventEmitter.emit(DomainEvents.PAYMENT_RECEIVED_AFTER_ORDER_CANCELLED, {
        orderId: transaction.orderId,
        tenantId: transaction.tenantId,
        transactionId: transaction.id,
        total: transaction.amount,
      });
      return { status: 'confirmed_but_order_already_cancelled' };
    }

    // Emitted after the state change commits, not before — listeners should
    // only ever react to something that actually happened.
    this.eventEmitter.emit(DomainEvents.ORDER_CONFIRMED, {
      orderId: transaction.orderId,
      tenantId: transaction.tenantId,
      transactionId: transaction.id,
      total: transaction.amount,
    });

    return { status: 'confirmed' };
  }
}
