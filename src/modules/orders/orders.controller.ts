import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles('owner', 'staff')
  @Get()
  async list() {
    return this.ordersService.list();
  }

  @Roles('owner', 'staff')
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.ordersService.getById(id);
  }

  @Roles('owner', 'staff')
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  /**
   * Checkout — public/unauthenticated. TenantContextMiddleware (applied to
   * this route in AppModule) resolves :slug to a tenant before this runs, the
   * same as the public storefront GET route in MerchantsController.
   */
  @Public()
  @Post('public/storefront/:slug/checkout')
  async checkout(@Body() dto: CreateOrderDto) {
    return this.ordersService.checkout(dto);
  }
}
