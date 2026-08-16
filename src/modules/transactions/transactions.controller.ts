import { Controller, Get, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('owner', 'staff')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async list() {
    return this.transactionsService.list();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.transactionsService.getById(id);
  }
}
