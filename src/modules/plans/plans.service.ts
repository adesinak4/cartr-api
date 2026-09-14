import { Injectable } from '@nestjs/common';
import { PlansRepository } from './plans.repository';
import { PlanPricesRepository } from './plan-prices.repository';
import { NotFoundError, ValidationError } from '../../common/errors';
import { Plan, PlanPrice } from '../../db/schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

const VALID_PERIODS = [3, 6, 12];

@Injectable()
export class PlansService {
  constructor(
    private readonly plansRepository: PlansRepository,
    private readonly planPricesRepository: PlanPricesRepository,
  ) {}

  async list(): Promise<Plan[]> {
    return this.plansRepository.findMany();
  }

  async getById(id: string): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) throw new NotFoundError('Plan not found');
    return plan;
  }

  /** All plans (including archived) with their period pricing attached — admin use only. */
  async listWithPrices(): Promise<Array<Plan & { prices: PlanPrice[] }>> {
    const allPlans = await this.plansRepository.findMany();
    return this.attachPrices(allPlans);
  }

  /** Excludes archived plans — the shape the public pricing UI (onboarding, dashboard plan picker) needs. */
  async listPublicWithPrices(): Promise<Array<Plan & { prices: PlanPrice[] }>> {
    const allPlans = await this.plansRepository.findMany();
    return this.attachPrices(allPlans.filter((p) => !p.archivedAt));
  }

  private async attachPrices(plans: Plan[]): Promise<Array<Plan & { prices: PlanPrice[] }>> {
    return Promise.all(
      plans.map(async (plan) => ({
        ...plan,
        prices: await this.planPricesRepository.findByPlanId(plan.id),
      })),
    );
  }

  /** Throws if no price has been configured for this plan/period — never silently falls back to a guessed amount. */
  async getPrice(planId: string, periodMonths: number): Promise<PlanPrice> {
    const price = await this.planPricesRepository.findByPlanAndPeriod(planId, periodMonths);
    if (!price) {
      throw new NotFoundError(`No price configured for plan ${planId} at ${periodMonths} months`);
    }
    return price;
  }

  /** Admin-only — see AdminPlansController. */
  async setPrice(planId: string, periodMonths: number, totalPrice: string): Promise<PlanPrice> {
    if (!VALID_PERIODS.includes(periodMonths)) {
      throw new ValidationError(`periodMonths must be one of ${VALID_PERIODS.join(', ')}`);
    }
    await this.getById(planId); // throws NotFoundError if the plan itself doesn't exist
    return this.planPricesRepository.upsert(planId, periodMonths, totalPrice);
  }

  /** Admin-only — see AdminPlansController. */
  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    return this.plansRepository.insertOne({
      name: dto.name,
      monthlyPrice: dto.monthlyPrice,
      transactionFeePercent: dto.transactionFeePercent,
      features: dto.features,
    });
  }

  /** Admin-only — partial update, name/prices/fee/features. */
  async updatePlan(planId: string, dto: UpdatePlanDto): Promise<Plan> {
    await this.getById(planId);
    const updated = await this.plansRepository.updateById(planId, dto);
    if (!updated) throw new NotFoundError('Plan not found');
    return updated;
  }

  /** Retires a plan from public listing — existing merchants on it are unaffected. */
  async archivePlan(planId: string): Promise<Plan> {
    await this.getById(planId);
    const updated = await this.plansRepository.updateById(planId, { archivedAt: new Date() });
    if (!updated) throw new NotFoundError('Plan not found');
    return updated;
  }

  async unarchivePlan(planId: string): Promise<Plan> {
    await this.getById(planId);
    const updated = await this.plansRepository.updateById(planId, { archivedAt: null });
    if (!updated) throw new NotFoundError('Plan not found');
    return updated;
  }
}
