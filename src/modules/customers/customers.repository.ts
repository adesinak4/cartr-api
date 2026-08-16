import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { TenantContext } from '../../common/tenant/tenant-context';
import { Customer, customers, NewCustomer } from '../../db/schema';

@Injectable()
export class CustomersRepository extends TenantScopedRepository<Customer, NewCustomer> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, customers);
  }

  /** Dedupe key for guest checkout: same phone within a store = same customer. */
  async findByPhone(phone: string): Promise<Customer | null> {
    const tenantId = TenantContext.requireTenantId();
    const [row] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.tenantId, tenantId), eq(customers.phone, phone)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Find-or-create for guest checkout. Uses an atomic upsert on the
   * (tenantId, phone) unique index rather than check-then-insert, since two
   * concurrent checkouts from the same customer would otherwise race past a
   * plain existence check and collide on the constraint.
   */
  async findOrCreate(values: Omit<NewCustomer, 'tenantId'>): Promise<Customer> {
    const tenantId = TenantContext.requireTenantId();
    const [row] = await this.db
      .insert(customers)
      .values({ ...values, tenantId })
      .onConflictDoUpdate({
        target: [customers.tenantId, customers.phone],
        // name/email may have changed since their last order — keep them fresh
        set: { name: values.name, email: values.email, updatedAt: new Date() },
      })
      .returning();
    return row;
  }
}
