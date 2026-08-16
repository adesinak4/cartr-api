import { Module } from '@nestjs/common';
import { PaymentAccountsController } from './payment-accounts.controller';
import { PaymentAccountsService } from './payment-accounts.service';
import { PaymentAccountsRepository } from './payment-accounts.repository';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';
import { MerchantsModule } from '../merchants/merchants.module';

@Module({
  imports: [FlutterwaveModule, MerchantsModule],
  controllers: [PaymentAccountsController],
  providers: [PaymentAccountsService, PaymentAccountsRepository],
  exports: [PaymentAccountsService, PaymentAccountsRepository],
})
export class PaymentAccountsModule {}
