import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { TenantContext } from '../../common/tenant/tenant-context';
import { NewPaymentAccount, PaymentAccount, paymentAccounts } from '../../db/schema';

@Injectable()
export class PaymentAccountsRepository extends TenantScopedRepository<
  PaymentAccount,
  NewPaymentAccount
> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, paymentAccounts);
  }

  /** One payout account per merchant — fetch by tenant rather than by row id. */
  async findForCurrentTenant(): Promise<PaymentAccount | null> {
    const tenantId = TenantContext.requireTenantId();
    const [row] = await this.db
      .select()
      .from(paymentAccounts)
      .where(eq(paymentAccounts.tenantId, tenantId))
      .limit(1);
    return row ?? null;
  }
}
