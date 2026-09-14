import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { merchants, planPrices, plans, subscriptionCharges, transactions } from '../../db/schema';

export interface AdminStatsOverview {
  merchants: {
    total: number;
    active: number;
    suspended: number;
    bySubscriptionStatus: Record<string, number>;
    newInLast7Days: number;
  };
  revenue: {
    /** Monthly-equivalent, summed across merchants currently on an active subscription. */
    estimatedMrr: number;
    /** Historical actual — all-time successful subscription charges. */
    totalSubscriptionRevenueCollected: number;
    /** Historical actual — platform's cut of all-time successful storefront sales. */
    totalPlatformFeeRevenue: number;
  };
  operations: {
    pastDueMerchants: number;
    pendingDomainProvisioningTasks: number;
  };
}

@Injectable()
export class AdminStatsService {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async overview(): Promise<AdminStatsOverview> {
    const [
      totalMerchants,
      activeMerchants,
      suspendedMerchants,
      bySubscriptionStatusRows,
      newIn7Days,
      subscriptionRevenueRow,
      platformFeeRow,
      pastDueCount,
      pendingDomainTasksCount,
      mrrInputs,
    ] = await Promise.all([
      this.countRows(sql`select count(*)::int as count from merchants`),
      this.countRows(
        sql`select count(*)::int as count from merchants where account_status = 'active'`,
      ),
      this.countRows(
        sql`select count(*)::int as count from merchants where account_status = 'suspended'`,
      ),
      this.db
        .select({ status: merchants.subscriptionStatus, count: sql<number>`count(*)::int` })
        .from(merchants)
        .groupBy(merchants.subscriptionStatus),
      this.countRows(
        sql`select count(*)::int as count from merchants where created_at >= now() - interval '7 days'`,
      ),
      this.db
        .select({ total: sql<string>`coalesce(sum(amount), 0)` })
        .from(subscriptionCharges)
        .where(eq(subscriptionCharges.status, 'success')),
      this.db
        .select({ total: sql<string>`coalesce(sum(platform_fee), 0)` })
        .from(transactions)
        .where(eq(transactions.status, 'success')),
      this.countRows(
        sql`select count(*)::int as count from merchants where subscription_status = 'past_due'`,
      ),
      this.countRows(
        sql`select count(*)::int as count from domain_provisioning_tasks where status = 'pending'`,
      ),
      this.mrrInputs(),
    ]);

    const bySubscriptionStatus: Record<string, number> = {};
    for (const row of bySubscriptionStatusRows) {
      bySubscriptionStatus[row.status] = row.count;
    }

    return {
      merchants: {
        total: totalMerchants,
        active: activeMerchants,
        suspended: suspendedMerchants,
        bySubscriptionStatus,
        newInLast7Days: newIn7Days,
      },
      revenue: {
        estimatedMrr: this.computeMrr(mrrInputs),
        totalSubscriptionRevenueCollected: Number(subscriptionRevenueRow[0]?.total ?? 0),
        totalPlatformFeeRevenue: Number(platformFeeRow[0]?.total ?? 0),
      },
      operations: {
        pastDueMerchants: pastDueCount,
        pendingDomainProvisioningTasks: pendingDomainTasksCount,
      },
    };
  }

  /** postgres-js driver returns rows directly (array-like), not a {rows:[]} wrapper. */
  private async countRows(query: ReturnType<typeof sql>): Promise<number> {
    const result = (await this.db.execute(query)) as unknown as Array<{ count: number }>;
    return result[0]?.count ?? 0;
  }

  /** Two small bulk selects, not a per-merchant loop — see the query-optimization doctrine on N+1. */
  private async mrrInputs() {
    const [activeMerchants, allPrices, allPlans] = await Promise.all([
      this.db
        .select({ planId: merchants.planId, billingPeriodMonths: merchants.billingPeriodMonths })
        .from(merchants)
        .where(
          and(
            eq(merchants.subscriptionStatus, 'active'),
            inArray(merchants.accountStatus, ['active']),
          ),
        ),
      this.db.select().from(planPrices),
      this.db.select({ id: plans.id, monthlyPrice: plans.monthlyPrice }).from(plans),
    ]);
    return { activeMerchants, allPrices, allPlans };
  }

  private computeMrr(inputs: Awaited<ReturnType<AdminStatsService['mrrInputs']>>): number {
    const { activeMerchants, allPrices, allPlans } = inputs;
    const planMonthlyPrice = new Map(allPlans.map((p) => [p.id, Number(p.monthlyPrice)]));
    const priceByPlanAndPeriod = new Map(
      allPrices.map((p) => [`${p.planId}:${p.periodMonths}`, Number(p.totalPrice)]),
    );

    let mrr = 0;
    for (const merchant of activeMerchants) {
      if (!merchant.planId) continue;

      if (merchant.billingPeriodMonths) {
        const total = priceByPlanAndPeriod.get(
          `${merchant.planId}:${merchant.billingPeriodMonths}`,
        );
        if (total !== undefined) {
          mrr += total / merchant.billingPeriodMonths;
          continue;
        }
      }

      // Legacy fallback — pre-period-pricing merchants, same rule SubscriptionsService uses.
      mrr += planMonthlyPrice.get(merchant.planId) ?? 0;
    }

    return Math.round(mrr * 100) / 100;
  }
}
