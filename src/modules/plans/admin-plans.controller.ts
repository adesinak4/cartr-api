import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { PlansService } from './plans.service';
import { UpdatePlanPriceDto } from './dto/update-plan-price.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';

/** Ops-facing plan/price/fee management — separate from the public PlansController. */
@Controller('admin/plans')
export class AdminPlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly auditService: AuditService,
  ) {}

  @Roles('admin', 'support')
  @Get()
  async list() {
    return this.plansService.listWithPrices();
  }

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreatePlanDto) {
    const plan = await this.plansService.createPlan(dto);
    await this.auditService.log('plan.created', 'plan', plan.id, { name: plan.name });
    return plan;
  }

  @Roles('admin')
  @Patch(':planId')
  async update(@Param('planId') planId: string, @Body() dto: UpdatePlanDto) {
    const plan = await this.plansService.updatePlan(planId, dto);
    await this.auditService.log('plan.updated', 'plan', plan.id, dto as Record<string, unknown>);
    return plan;
  }

  @Roles('admin')
  @Patch(':planId/prices')
  async setPrice(@Param('planId') planId: string, @Body() dto: UpdatePlanPriceDto) {
    const price = await this.plansService.setPrice(planId, dto.periodMonths, dto.totalPrice);
    await this.auditService.log('plan.price_updated', 'plan', planId, {
      periodMonths: dto.periodMonths,
      totalPrice: dto.totalPrice,
    });
    return price;
  }

  @Roles('admin')
  @Patch(':planId/archive')
  async archive(@Param('planId') planId: string) {
    const plan = await this.plansService.archivePlan(planId);
    await this.auditService.log('plan.archived', 'plan', plan.id);
    return plan;
  }

  @Roles('admin')
  @Patch(':planId/unarchive')
  async unarchive(@Param('planId') planId: string) {
    const plan = await this.plansService.unarchivePlan(planId);
    await this.auditService.log('plan.unarchived', 'plan', plan.id);
    return plan;
  }
}
