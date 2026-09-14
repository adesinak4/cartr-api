import { Controller, Get, Param, Patch } from '@nestjs/common';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { SubscriptionChargesRepository } from '../subscriptions/subscription-charges.repository';

// Read endpoints allow 'support' too; destructive ones (suspend/reactivate)
// stay 'admin'-only — see the admin-permission-tier discussion.
@Controller('admin/merchants')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
    private readonly subscriptionChargesRepository: SubscriptionChargesRepository,
  ) {}

  @Roles('admin', 'support')
  @Get()
  async listMerchants() {
    return this.adminService.listMerchants();
  }

  @Roles('admin', 'support')
  @Get(':id')
  async getMerchant(@Param('id') id: string) {
    return this.adminService.getMerchant(id);
  }

  /**
   * Billing/subscription-charge history for one merchant — pair with
   * GET /admin/orders?tenantId=, GET /admin/transactions?tenantId=, and
   * GET /admin/users?tenantId= (all already tenantId-filterable) to build
   * the full merchant-detail picture.
   */
  @Roles('admin', 'support')
  @Get(':id/billing-history')
  async getBillingHistory(@Param('id') id: string) {
    return this.subscriptionChargesRepository.findByTenantIdUnscoped(id);
  }

  @Roles('admin')
  @Patch(':id/suspend')
  async suspend(@Param('id') id: string) {
    const merchant = await this.adminService.suspend(id);
    await this.auditService.log('merchant.suspended', 'merchant', merchant.id);
    return merchant;
  }

  @Roles('admin')
  @Patch(':id/reactivate')
  async reactivate(@Param('id') id: string) {
    const merchant = await this.adminService.reactivate(id);
    await this.auditService.log('merchant.reactivated', 'merchant', merchant.id);
    return merchant;
  }
}
