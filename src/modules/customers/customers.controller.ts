import { Controller, Get, Param } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('owner', 'staff')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async list() {
    return this.customersService.list();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.customersService.getById(id);
  }
}
