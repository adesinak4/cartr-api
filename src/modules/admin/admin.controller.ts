import { Controller, Get, Param, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('admin')
@Controller('admin/merchants')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async listMerchants() {
    return this.adminService.listMerchants();
  }

  @Get(':id')
  async getMerchant(@Param('id') id: string) {
    return this.adminService.getMerchant(id);
  }

  @Patch(':id/suspend')
  async suspend(@Param('id') id: string) {
    return this.adminService.suspend(id);
  }

  @Patch(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    return this.adminService.reactivate(id);
  }
}
