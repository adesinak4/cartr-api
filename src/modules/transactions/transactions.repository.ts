import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { NewTransaction, orders, Transaction, transactions, merchants } from '../../db/schema';

export interface AdminTransactionListFilter {
  status?: Transaction['status'];
  tenantId?: string;
  limit?: number;
  offset?: number;
}

export interface AdminTransactionRow extends Transaction {
  merchantSlug: string;
  merchantStoreName: string;
}

@Injectable()
export class TransactionsRepository extends TenantScopedRepository<Transaction, NewTransaction> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, transactions);
  }

  /** Unscoped, joined with merchant identity — for the admin transactions list. */
  async listUnscoped(filter: AdminTransactionListFilter = {}): Promise<AdminTransactionRow[]> {
    const clauses = [
      filter.status ? eq(transactions.status, filter.status) : undefined,
      filter.tenantId ? eq(transactions.tenantId, filter.tenantId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => !!c);

    return this.db
      .select({
        id: transactions.id,
        orderId: transactions.orderId,
        tenantId: transactions.tenantId,
        provider: transactions.provider,
        providerReference: transactions.providerReference,
        amount: transactions.amount,
        platformFee: transactions.platformFee,
        merchantAmount: transactions.merchantAmount,
        status: transactions.status,
        flutterwaveTransactionId: transactions.flutterwaveTransactionId,
        refundedAt: transactions.refundedAt,
        refundReference: transactions.refundReference,
        refundInitiatedBy: transactions.refundInitiatedBy,
        createdAt: transactions.createdAt,
        updatedAt: transactions.updatedAt,
        merchantSlug: merchants.slug,
        merchantStoreName: merchants.storeName,
      })
      .from(transactions)
      .innerJoin(merchants, eq(transactions.tenantId, merchants.id))
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(transactions.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);
  }

  /**
   * Unscoped by design — the webhook handler has no TenantContext yet at the
   * point it needs to look up which transaction/tenant a provider event
   * belongs to (that's what this lookup exists to discover in the first
   * place). `tenantId` is denormalized on the row precisely so callers can
   * re-enter TenantContext with it immediately after this call.
   */
  async findByProviderReference(providerReference: string): Promise<Transaction | null> {
    const [row] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.providerReference, providerReference))
      .limit(1);
    return row ?? null;
  }

  /**
   * Marks the transaction successful and confirms its order — atomically,
   * one DB transaction. Stock is NOT touched here: it was already reserved
   * (decremented) at checkout time (OrdersRepository.createWithItems), so
   * decrementing again here would double-count it.
   *
   * The order-confirm update is conditional on `WHERE status = 'pending'`
   * and returns whether it actually fired. This is the race guard against
   * OrdersRepository.releaseReservation: if the reservation-expiry task
   * cancelled this order moments before this webhook arrived, the update
   * affects 0 rows, this method returns false, and the caller (WebhooksService)
   * knows not to treat the order as newly confirmed — see
   * DomainEvents.PAYMENT_RECEIVED_AFTER_ORDER_CANCELLED. The transaction is
   * still marked 'success' either way — money genuinely arrived and that
   * fact must never be dropped, regardless of what happened to the order.
   *
   * flutterwaveTransactionId is persisted here (distinct from
   * providerReference, our own tx_ref) — it's the id a later refund needs to
   * call Flutterwave's refund endpoint against.
   */
  async markSuccessAndConfirmOrder(
    transactionId: string,
    orderId: string,
    flutterwaveTransactionId: string,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx
        .update(transactions)
        .set({ status: 'success', flutterwaveTransactionId, updatedAt: new Date() })
        .where(eq(transactions.id, transactionId));

      const [confirmed] = await tx
        .update(orders)
        .set({ status: 'confirmed', updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
        .returning({ id: orders.id });

      return Boolean(confirmed);
    });
  }

  async markFailed(transactionId: string): Promise<void> {
    await this.db
      .update(transactions)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(transactions.id, transactionId));
  }

  /**
   * Unscoped, same rationale as findByProviderReference — the admin refund
   * flow has no TenantContext (an admin isn't tied to one tenant). orderId
   * is already a specific, non-guessable UUID, so this doesn't broaden
   * access beyond what OrdersRepository.findByIdUnscoped already established.
   */
  async findByOrderId(orderId: string): Promise<Transaction | null> {
    const [row] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.orderId, orderId))
      .limit(1);
    return row ?? null;
  }

  /**
   * Atomically refunds a transaction and marks its order refunded — same
   * structure as markSuccessAndConfirmOrder. Conditional on the transaction
   * still being 'success' (guards against a concurrent double-refund
   * attempt landing here after Flutterwave has already been called once);
   * returns false with no order-side write if that guard doesn't match.
   */
  async recordRefund(
    transactionId: string,
    orderId: string,
    refundReference: string,
    refundInitiatedBy: string,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [refunded] = await tx
        .update(transactions)
        .set({
          status: 'refunded',
          refundedAt: new Date(),
          refundReference,
          refundInitiatedBy,
          updatedAt: new Date(),
        })
        .where(and(eq(transactions.id, transactionId), eq(transactions.status, 'success')))
        .returning({ id: transactions.id });

      if (!refunded) return false;

      await tx
        .update(orders)
        .set({ status: 'refunded', updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      return true;
    });
  }
}
