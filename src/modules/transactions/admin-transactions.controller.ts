import { Controller, Get, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { AdminListTransactionsDto } from './dto/admin-list-transactions.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('admin', 'support')
@Controller('admin/transactions')
export class AdminTransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async list(@Query() query: AdminListTransactionsDto) {
    return this.transactionsService.adminList({ status: query.status, tenantId: query.tenantId });
  }
}
