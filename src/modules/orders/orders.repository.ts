import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { TenantContext } from '../../common/tenant/tenant-context';
import { InsufficientStockError } from '../../common/errors';
import {
  NewOrder,
  NewOrderItem,
  Order,
  orderItems,
  orders,
  OrderItem,
  products,
  merchants,
} from '../../db/schema';

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export interface AdminOrderListFilter {
  status?: Order['status'];
  tenantId?: string;
  limit?: number;
  offset?: number;
}

export interface AdminOrderRow extends Order {
  merchantSlug: string;
  merchantStoreName: string;
}

@Injectable()
export class OrdersRepository extends TenantScopedRepository<Order, NewOrder> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, orders);
  }

  /**
   * Order + order_items + stock reservation, all atomic — a customer must
   * never end up with an order that has no line items, and stock must never
   * be decremented without a corresponding order existing. Reservation is
   * gated on `stock >= qty` at the DB level: Postgres row-locks each
   * product row on UPDATE, so two concurrent checkouts for the last unit are
   * serialized — one wins, the other's gate fails and the whole transaction
   * (including the order and any earlier items already decremented in this
   * same loop) rolls back automatically. This is the actual oversell guard;
   * there's no separate reservation/hold table.
   */
  async createWithItems(
    orderValues: Omit<NewOrder, 'tenantId'>,
    itemValues: Omit<NewOrderItem, 'orderId'>[],
  ): Promise<OrderWithItems> {
    const tenantId = TenantContext.requireTenantId();

    return this.db.transaction(async (tx) => {
      const [order] = await tx
        .insert(orders)
        .values({ ...orderValues, tenantId })
        .returning();

      for (const item of itemValues) {
        if (!item.productId) continue; // defensive — DTO always sets this on create
        const [row] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${item.qty}`, updatedAt: new Date() })
          .where(and(eq(products.id, item.productId), sql`${products.stock} >= ${item.qty}`))
          .returning({ name: products.name });

        if (!row) {
          throw new InsufficientStockError(`Not enough stock for "${item.productNameSnapshot}"`);
        }
      }

      const items = await tx
        .insert(orderItems)
        .values(itemValues.map((item) => ({ ...item, orderId: order.id })))
        .returning();

      return { ...order, items };
    });
  }

  async findByIdWithItems(id: string): Promise<OrderWithItems | null> {
    const order = await this.findById(id);
    if (!order) return null;

    const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  /**
   * Unscoped — for the admin refund flow, which has no TenantContext (an
   * admin isn't tied to one tenant). TenantScopedRepository deliberately
   * exposes no unscoped path, so this bypasses the scoped base methods
   * entirely and queries the table directly, same technique already used by
   * findStalePendingWithItems/releaseReservation below.
   */
  async findByIdUnscoped(id: string): Promise<Order | null> {
    const [row] = await this.db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return row ?? null;
  }

  /** Unscoped, joined with merchant identity — for the admin orders list. */
  async listUnscoped(filter: AdminOrderListFilter = {}): Promise<AdminOrderRow[]> {
    const clauses = [
      filter.status ? eq(orders.status, filter.status) : undefined,
      filter.tenantId ? eq(orders.tenantId, filter.tenantId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => !!c);

    return this.db
      .select({
        id: orders.id,
        tenantId: orders.tenantId,
        customerId: orders.customerId,
        status: orders.status,
        subtotal: orders.subtotal,
        deliveryFee: orders.deliveryFee,
        total: orders.total,
        currency: orders.currency,
        deliveryStreet: orders.deliveryStreet,
        deliveryCity: orders.deliveryCity,
        deliveryState: orders.deliveryState,
        note: orders.note,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        merchantSlug: merchants.slug,
        merchantStoreName: merchants.storeName,
      })
      .from(orders)
      .innerJoin(merchants, eq(orders.tenantId, merchants.id))
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);
  }

  /** Unscoped, with items — for the admin order-detail view. */
  async findByIdUnscopedWithItems(id: string): Promise<OrderWithItems | null> {
    const order = await this.findByIdUnscoped(id);
    if (!order) return null;

    const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { ...order, items };
  }

  /** Unscoped — the reservation-expiry task runs outside any tenant's request context. */
  async findStalePendingWithItems(olderThan: Date): Promise<OrderWithItems[]> {
    const staleOrders = await this.db
      .select()
      .from(orders)
      .where(and(eq(orders.status, 'pending'), lt(orders.createdAt, olderThan)));

    const results: OrderWithItems[] = [];
    for (const order of staleOrders) {
      const items = await this.db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      results.push({ ...order, items });
    }
    return results;
  }

  /**
   * Releases a reservation: cancels the order and adds its stock back — but
   * only if the order is still 'pending'. The conditional `WHERE status =
   * 'pending'` is what makes this safe to race against a concurrent webhook
   * trying to confirm the same order (see WebhooksService) — whichever gets
   * there first wins atomically; the loser's update affects 0 rows and
   * `releaseReservation` returns false, telling the caller not to also
   * release stock a webhook may have already committed to a confirmed order.
   * Unscoped, same reasoning as markSuccessAndConfirmOrder in
   * TransactionsRepository — called from contexts with no tenant on the
   * request (this task, or the webhook's own unscoped lookup).
   */
  async releaseReservation(
    orderId: string,
    items: { productId: string | null; qty: number }[],
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [cancelled] = await tx
        .update(orders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
        .returning({ id: orders.id });

      if (!cancelled) return false;

      for (const item of items) {
        if (!item.productId) continue;
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${item.qty}`, updatedAt: new Date() })
          .where(eq(products.id, item.productId));
      }

      return true;
    });
  }
}
