import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import { NewPlanPrice, PlanPrice, planPrices } from '../../db/schema';

@Injectable()
export class PlanPricesRepository extends BaseRepository<PlanPrice, NewPlanPrice> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, planPrices);
  }

  async findByPlanId(planId: string): Promise<PlanPrice[]> {
    return this.db.select().from(planPrices).where(eq(planPrices.planId, planId));
  }

  async findByPlanAndPeriod(planId: string, periodMonths: number): Promise<PlanPrice | null> {
    const [row] = await this.db
      .select()
      .from(planPrices)
      .where(and(eq(planPrices.planId, planId), eq(planPrices.periodMonths, periodMonths)))
      .limit(1);
    return row ?? null;
  }

  /** Creates the (plan, period) row if it doesn't exist yet, otherwise updates its price. */
  async upsert(planId: string, periodMonths: number, totalPrice: string): Promise<PlanPrice> {
    const existing = await this.findByPlanAndPeriod(planId, periodMonths);

    if (existing) {
      const [updated] = await this.db
        .update(planPrices)
        .set({ totalPrice, updatedAt: new Date() })
        .where(eq(planPrices.id, existing.id))
        .returning();
      return updated;
    }

    return this.insertOne({ planId, periodMonths, totalPrice });
  }
}
