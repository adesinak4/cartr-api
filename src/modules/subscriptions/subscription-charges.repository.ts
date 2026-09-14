import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { TenantContext } from '../../common/tenant/tenant-context';
import {
  merchants,
  NewMerchant,
  NewSubscriptionCharge,
  subscriptionCharges,
  SubscriptionCharge,
} from '../../db/schema';

@Injectable()
export class SubscriptionChargesRepository extends TenantScopedRepository<
  SubscriptionCharge,
  NewSubscriptionCharge
> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, subscriptionCharges);
  }

  /**
   * Unscoped by design, same rationale as TransactionsRepository's version —
   * the webhook handler has no TenantContext yet when it needs to discover
   * which tenant a provider event belongs to in the first place.
   */
  async findByProviderReference(providerReference: string): Promise<SubscriptionCharge | null> {
    const [row] = await this.db
      .select()
      .from(subscriptionCharges)
      .where(eq(subscriptionCharges.providerReference, providerReference))
      .limit(1);
    return row ?? null;
  }

  /** Unscoped — admin's per-merchant billing history view. */
  async findByTenantIdUnscoped(tenantId: string): Promise<SubscriptionCharge[]> {
    return this.db
      .select()
      .from(subscriptionCharges)
      .where(eq(subscriptionCharges.tenantId, tenantId))
      .orderBy(desc(subscriptionCharges.createdAt));
  }

  /** `tenantId` optional — see PaymentMethodsRepository.findActive for the same convention. */
  async createForTenant(
    values: Omit<NewSubscriptionCharge, 'tenantId'>,
    tenantId?: string,
  ): Promise<SubscriptionCharge> {
    const scopeId = tenantId ?? TenantContext.requireTenantId();
    const [row] = await this.db
      .insert(subscriptionCharges)
      .values({ ...values, tenantId: scopeId })
      .returning();
    return row;
  }

  /**
   * Atomically updates a charge row and its merchant's billing state
   * together — one DB transaction, same "both writes succeed together or
   * neither does" discipline as OrdersRepository.createWithItems and
   * TransactionsRepository.markSuccessAndConfirmOrder. Touches `merchants`
   * directly (not via MerchantsRepository) per the established
   * cross-table-in-one-repository-method precedent.
   */
  async recordChargeResult(
    chargeId: string,
    chargeUpdate: Partial<NewSubscriptionCharge>,
    merchantId: string,
    merchantUpdate: Partial<NewMerchant>,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(subscriptionCharges)
        .set({ ...chargeUpdate, updatedAt: new Date() })
        .where(eq(subscriptionCharges.id, chargeId));

      await tx
        .update(merchants)
        .set({ ...merchantUpdate, updatedAt: new Date() })
        .where(eq(merchants.id, merchantId));
    });
  }
}
