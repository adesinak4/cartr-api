import { Injectable, Logger } from '@nestjs/common';
import { OrdersRepository, OrderWithItems } from './orders.repository';
import { ProductsRepository } from '../products/products.repository';
import { CustomersService } from '../customers/customers.service';
import { PaymentAccountsService } from '../payment-accounts/payment-accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { MerchantsService } from '../merchants/merchants.service';
import { PlansService } from '../plans/plans.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { AppConfigService } from '../../config/app-config.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import {
  NotFoundError,
  PayoutAccountNotReadyError,
  TransactionNotRefundableError,
  ValidationError,
} from '../../common/errors';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvents } from '../../common/events/domain-events';
import { NewOrderItem, Order } from '../../db/schema';

const DEFAULT_DELIVERY_FEE = '0';

export interface CheckoutResult {
  order: OrderWithItems;
  paymentLink: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly productsRepository: ProductsRepository,
    private readonly customersService: CustomersService,
    private readonly paymentAccountsService: PaymentAccountsService,
    private readonly transactionsService: TransactionsService,
    private readonly merchantsService: MerchantsService,
    private readonly plansService: PlansService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly config: AppConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(): Promise<Order[]> {
    return this.ordersRepository.findMany();
  }

  async getById(id: string): Promise<OrderWithItems> {
    const order = await this.ordersRepository.findByIdWithItems(id);
    if (!order) throw new NotFoundError('Order not found');
    return order;
  }

  /**
   * Places an order — resolves/creates the guest customer record, snapshots
   * each product's current name/price onto the order line (so later edits to
   * the product never rewrite historical order data), computes totals
   * server-side, and atomically reserves stock for every item as part of
   * order creation (OrdersRepository.createWithItems — throws
   * InsufficientStockError and rolls back the whole order if any item can't
   * be reserved). Pure order + reservation, no payment knowledge — see
   * checkout() for that orchestration.
   */
  async create(dto: CreateOrderDto): Promise<OrderWithItems> {
    if (dto.items.length === 0) {
      throw new ValidationError('An order must have at least one item');
    }

    const customer = await this.customersService.findOrCreate(dto.customer);

    const itemValues: Omit<NewOrderItem, 'orderId'>[] = [];
    let subtotal = 0;

    for (const item of dto.items) {
      const product = await this.productsRepository.findById(item.productId);
      if (!product) {
        throw new NotFoundError(`Product ${item.productId} not found`);
      }
      if (product.status !== 'active') {
        throw new ValidationError(`Product "${product.name}" is not available for purchase`);
      }
      // Stock sufficiency is NOT checked here — this read can be stale the
      // instant another checkout runs concurrently. The real, race-safe
      // check happens atomically inside createWithItems, at the DB level.

      const price = Number(product.price);
      const lineTotal = price * item.qty;
      subtotal += lineTotal;

      itemValues.push({
        productId: product.id,
        productNameSnapshot: product.name,
        priceSnapshot: product.price,
        qty: item.qty,
        lineTotal: lineTotal.toFixed(2),
      });
    }

    const total = subtotal + Number(DEFAULT_DELIVERY_FEE);

    return this.ordersRepository.createWithItems(
      {
        customerId: customer.id,
        status: 'pending',
        subtotal: subtotal.toFixed(2),
        deliveryFee: DEFAULT_DELIVERY_FEE,
        total: total.toFixed(2),
        currency: 'NGN',
        deliveryStreet: dto.deliveryStreet,
        deliveryCity: dto.deliveryCity,
        deliveryState: dto.deliveryState,
        note: dto.note,
      },
      itemValues,
    );
  }

  /**
   * Full checkout: creates the order + stock reservation (via create()
   * above), then gates on the merchant actually being able to receive
   * money, computes the platform's cut from the merchant's current plan,
   * records a pending Transaction keyed by the order's own id (also the
   * webhook idempotency key), and initializes the Flutterwave payment.
   * Returns the hosted payment link for the frontend to redirect the
   * customer to — order confirmation happens later, asynchronously, via the
   * Flutterwave webhook (see WebhooksService), not here.
   */
  async checkout(dto: CreateOrderDto): Promise<CheckoutResult> {
    const paymentAccount = await this.paymentAccountsService.requireReadyForCheckout();

    const merchant = await this.merchantsService.getCurrent();
    if (!merchant.planId) {
      throw new PayoutAccountNotReadyError(
        'This store has no active plan — cannot process payment until one is assigned',
      );
    }
    const plan = await this.plansService.getById(merchant.planId);

    const order = await this.create(dto);

    const platformChargePercent = Number(plan.transactionFeePercent);
    const total = Number(order.total);
    // This is the GROSS service charge configured on the Flutterwave split —
    // confirmed from their docs that the main account (us) collects this
    // percentage and the subaccount (merchant) gets the rest. NOT confirmed
    // anywhere: whether Flutterwave's own processing fee comes out of this
    // cut, the merchant's, or the gross before the split. Don't treat
    // `platformFee` as a guaranteed net revenue figure until that's verified
    // against a live sandbox transaction — see README's Flutterwave section.
    const platformFee = (total * platformChargePercent) / 100;
    const merchantAmount = total - platformFee;

    await this.transactionsService.create({
      orderId: order.id,
      // order.id doubles as the Flutterwave tx_ref — already a unique UUID,
      // and it's exactly what the webhook idempotency lookup needs, so no
      // second identifier to generate or track.
      providerReference: order.id,
      provider: 'flutterwave',
      amount: order.total,
      platformFee: platformFee.toFixed(2),
      merchantAmount: merchantAmount.toFixed(2),
      status: 'pending',
    });

    const { paymentLink } = await this.flutterwaveService.initializePayment({
      txRef: order.id,
      amount: order.total,
      currency: order.currency,
      redirectUrl: dto.redirectUrl,
      customer: {
        name: dto.customer.name,
        email: dto.customer.email,
        phonenumber: dto.customer.phone,
      },
      subaccountId: paymentAccount.providerSubaccountId!,
      platformChargePercent,
    });

    return { order, paymentLink };
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const updated = await this.ordersRepository.updateById(id, { status: dto.status });
    if (!updated) throw new NotFoundError('Order not found');
    return updated;
  }

  /**
   * Releases one order's reservation — shared by the webhook's explicit
   * payment-failure path and the scheduled expiry task. Conditional on the
   * order still being 'pending' (see OrdersRepository.releaseReservation);
   * returns false without error if it's already been confirmed or released
   * by something else, so callers don't need their own idempotency check.
   */
  async releaseReservation(orderId: string): Promise<boolean> {
    const order = await this.ordersRepository.findByIdWithItems(orderId);
    if (!order) return false;

    return this.ordersRepository.releaseReservation(
      orderId,
      order.items.map((item) => ({ productId: item.productId, qty: item.qty })),
    );
  }

  /**
   * Admin-initiated full refund. Unscoped lookups throughout (no
   * TenantContext — an admin isn't tied to one tenant), same rationale as
   * the webhook flow's unscoped writes. Full refund only — see
   * FlutterwaveService.refund for the (documented) partial-refund mechanism
   * this deliberately doesn't use, and its important caveats about split
   * transactions and non-idempotent retries.
   */
  async refundOrder(orderId: string, adminUserId: string): Promise<Order> {
    const order = await this.ordersRepository.findByIdUnscoped(orderId);
    if (!order) throw new NotFoundError('Order not found');

    if (!['confirmed', 'shipped', 'delivered'].includes(order.status)) {
      throw new TransactionNotRefundableError(
        `Order in status '${order.status}' cannot be refunded`,
      );
    }

    const transaction = await this.transactionsService.findByOrderId(orderId);
    if (!transaction || transaction.status !== 'success') {
      throw new TransactionNotRefundableError('No successful payment found for this order');
    }
    if (!transaction.flutterwaveTransactionId) {
      throw new TransactionNotRefundableError(
        'No provider transaction reference recorded for this payment — cannot refund automatically',
      );
    }

    const refund = await this.flutterwaveService.refund(transaction.flutterwaveTransactionId);

    const recorded = await this.transactionsService.recordRefund(
      transaction.id,
      orderId,
      refund.refundId,
      adminUserId,
    );

    if (!recorded) {
      // Flutterwave's refund call already happened by the time this ran —
      // someone else's refund attempt won the race on our own DB guard a
      // moment earlier. Nothing left for us to reconcile on our side.
      throw new TransactionNotRefundableError('This transaction was already refunded');
    }

    const refunded = await this.ordersRepository.findByIdUnscoped(orderId);
    if (!refunded) throw new NotFoundError('Order not found');

    this.eventEmitter.emit(DomainEvents.ORDER_REFUNDED, {
      orderId,
      tenantId: order.tenantId,
      transactionId: transaction.id,
      total: transaction.amount,
      refundReference: refund.refundId,
    });

    return refunded;
  }

  /**
   * Called on a schedule (see tasks/expire-reservations.task.ts) — finds
   * every order still 'pending' past the reservation timeout and releases
   * each one. Best-effort per order: one failure doesn't stop the rest.
   */
  async expireStaleReservations(): Promise<{ released: number; failed: number }> {
    const cutoff = new Date(Date.now() - this.config.orderReservationTimeoutMinutes * 60_000);
    const stale = await this.ordersRepository.findStalePendingWithItems(cutoff);

    let released = 0;
    let failed = 0;

    for (const order of stale) {
      try {
        const didRelease = await this.ordersRepository.releaseReservation(
          order.id,
          order.items.map((item) => ({ productId: item.productId, qty: item.qty })),
        );
        if (didRelease) {
          released++;
          this.logger.log(`Released expired reservation for order ${order.id}`);
        }
      } catch (err) {
        failed++;
        this.logger.error(`Failed to release reservation for order ${order.id}`, err as Error);
      }
    }

    return { released, failed };
  }
}
