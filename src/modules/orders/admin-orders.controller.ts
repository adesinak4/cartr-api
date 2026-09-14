import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AdminListOrdersDto } from './dto/admin-list-orders.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Admin-only — refunds are not merchant self-service. Separate from
 * OrdersController (which is tenant-scoped and merchant-facing) since an
 * admin has no tenant context at all; see OrdersRepository.findByIdUnscoped.
 */
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
  ) {}

  @Roles('admin', 'support')
  @Get()
  async list(@Query() query: AdminListOrdersDto) {
    return this.ordersService.adminList({ status: query.status, tenantId: query.tenantId });
  }

  @Roles('admin', 'support')
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ordersService.adminGetById(id);
  }

  @Roles('admin')
  @Post(':id/refund')
  async refund(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const order = await this.ordersService.refundOrder(id, user.id);
    await this.auditService.log('order.refunded', 'order', order.id);
    return order;
  }
}
