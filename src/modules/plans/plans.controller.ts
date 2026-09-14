import { Controller, Get, Param } from '@nestjs/common';
import { PlansService } from './plans.service';
import { Public } from '../../common/decorators/public.decorator';

/** Plans are public reference data — shown on pricing pages, plan pickers, etc. */
@Public()
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async list() {
    // Prices included — the onboarding wizard and dashboard plan picker both
    // need period pricing, and prices aren't sensitive data. Archived plans
    // excluded — see AdminPlansController for the unfiltered admin view.
    return this.plansService.listPublicWithPrices();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.plansService.getById(id);
  }
}
