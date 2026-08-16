import { Body, Controller, Get, Post } from '@nestjs/common';
import { PaymentAccountsService } from './payment-accounts.service';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('owner')
@Controller('payment-accounts')
export class PaymentAccountsController {
  constructor(private readonly paymentAccountsService: PaymentAccountsService) {}

  @Get('me')
  async getCurrent() {
    return this.paymentAccountsService.getCurrent();
  }

  /** Bank list for a bank-code picker on the payout-setup form. */
  @Get('banks')
  async listBanks() {
    return this.paymentAccountsService.listBanks();
  }

  @Post()
  async create(@Body() dto: CreatePaymentAccountDto) {
    return this.paymentAccountsService.create(dto);
  }
}
