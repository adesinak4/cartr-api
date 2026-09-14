import { Controller, Get } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('admin', 'support')
@Controller('admin/stats')
export class AdminStatsController {
  constructor(private readonly adminStatsService: AdminStatsService) {}

  @Get('overview')
  async overview() {
    return this.adminStatsService.overview();
  }
}
