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
    return this.plansService.list();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.plansService.getById(id);
  }
}
