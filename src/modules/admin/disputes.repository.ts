import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import { Dispute, NewDispute, disputes, merchants } from '../../db/schema';

export interface DisputeListFilter {
  status?: 'open' | 'resolved';
  tenantId?: string;
}

export interface DisputeRow extends Dispute {
  merchantSlug: string;
  merchantStoreName: string;
}

@Injectable()
export class DisputesRepository extends BaseRepository<Dispute, NewDispute> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, disputes);
  }

  async listWithMerchant(filter: DisputeListFilter = {}): Promise<DisputeRow[]> {
    const clauses = [
      filter.status ? eq(disputes.status, filter.status) : undefined,
      filter.tenantId ? eq(disputes.tenantId, filter.tenantId) : undefined,
    ].filter((c): c is NonNullable<typeof c> => !!c);

    return this.db
      .select({
        id: disputes.id,
        orderId: disputes.orderId,
        tenantId: disputes.tenantId,
        reason: disputes.reason,
        status: disputes.status,
        resolutionNotes: disputes.resolutionNotes,
        createdBy: disputes.createdBy,
        resolvedBy: disputes.resolvedBy,
        createdAt: disputes.createdAt,
        resolvedAt: disputes.resolvedAt,
        merchantSlug: merchants.slug,
        merchantStoreName: merchants.storeName,
      })
      .from(disputes)
      .innerJoin(merchants, eq(disputes.tenantId, merchants.id))
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(disputes.createdAt));
  }
}
