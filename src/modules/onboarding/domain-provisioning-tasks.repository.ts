import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import {
  DomainProvisioningTask,
  NewDomainProvisioningTask,
  domainProvisioningTasks,
  merchants,
} from '../../db/schema';

export interface DomainProvisioningTaskWithMerchant extends DomainProvisioningTask {
  merchantSlug: string;
  merchantStoreName: string;
}

@Injectable()
export class DomainProvisioningTasksRepository extends BaseRepository<
  DomainProvisioningTask,
  NewDomainProvisioningTask
> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, domainProvisioningTasks);
  }

  /** Joined with merchant identity — avoids the admin UI doing an N+1 lookup per task. */
  async listWithMerchant(
    status?: 'pending' | 'done',
  ): Promise<DomainProvisioningTaskWithMerchant[]> {
    return this.db
      .select({
        id: domainProvisioningTasks.id,
        merchantId: domainProvisioningTasks.merchantId,
        desiredDomain: domainProvisioningTasks.desiredDomain,
        status: domainProvisioningTasks.status,
        createdAt: domainProvisioningTasks.createdAt,
        doneAt: domainProvisioningTasks.doneAt,
        merchantSlug: merchants.slug,
        merchantStoreName: merchants.storeName,
      })
      .from(domainProvisioningTasks)
      .innerJoin(merchants, eq(domainProvisioningTasks.merchantId, merchants.id))
      .where(status ? eq(domainProvisioningTasks.status, status) : undefined)
      .orderBy(desc(domainProvisioningTasks.createdAt));
  }
}
