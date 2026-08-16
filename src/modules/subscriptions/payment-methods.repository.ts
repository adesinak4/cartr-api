import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { TenantContext } from '../../common/tenant/tenant-context';
import { NewPaymentMethod, paymentMethods, PaymentMethod } from '../../db/schema';

@Injectable()
export class PaymentMethodsRepository extends TenantScopedRepository<
  PaymentMethod,
  NewPaymentMethod
> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, paymentMethods);
  }

  /**
   * `tenantId` optional — omit for dashboard-facing calls (TenantContext is
   * seeded from the JWT there); pass explicitly for the renewal cron, which
   * has no per-request tenant context while iterating multiple merchants.
   */
  async findActive(tenantId?: string): Promise<PaymentMethod | null> {
    const scopeId = tenantId ?? TenantContext.requireTenantId();
    const [row] = await this.db
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.tenantId, scopeId), eq(paymentMethods.status, 'active')))
      .limit(1);
    return row ?? null;
  }

  /**
   * Atomically supersedes whatever payment method is currently active with a
   * new one — history is kept (old row marked 'replaced', never deleted),
   * unlike `payment_accounts` which has a true one-per-tenant DB constraint.
   * Flutterwave has no in-place card-update primitive, so "the merchant
   * fixed their card" always means a brand-new token via this method.
   */
  async replaceActive(
    values: Omit<NewPaymentMethod, 'tenantId'>,
    tenantId?: string,
  ): Promise<PaymentMethod> {
    const scopeId = tenantId ?? TenantContext.requireTenantId();

    return this.db.transaction(async (tx) => {
      await tx
        .update(paymentMethods)
        .set({ status: 'replaced', updatedAt: new Date() })
        .where(and(eq(paymentMethods.tenantId, scopeId), eq(paymentMethods.status, 'active')));

      const [row] = await tx
        .insert(paymentMethods)
        .values({ ...values, tenantId: scopeId })
        .returning();

      return row;
    });
  }
}
