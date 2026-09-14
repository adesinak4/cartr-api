import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { AdminPlansController } from './admin-plans.controller';
import { PlansService } from './plans.service';
import { PlansRepository } from './plans.repository';
import { PlanPricesRepository } from './plan-prices.repository';

@Module({
  controllers: [PlansController, AdminPlansController],
  providers: [PlansService, PlansRepository, PlanPricesRepository],
  exports: [PlansService, PlansRepository, PlanPricesRepository],
})
export class PlansModule {}
