import { Controller, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

/**
 * Admin-only, v1 — refunds are not merchant self-service. Separate from
 * OrdersController (which is tenant-scoped and merchant-facing) since an
 * admin has no tenant context at all; see OrdersRepository.findByIdUnscoped.
 */
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post(':id/refund')
  async refund(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.refundOrder(id, user.id);
  }
}
