import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersService } from './orders.service';
import { OrdersRepository } from './orders.repository';
import { ExpireReservationsTask } from './tasks/expire-reservations.task';
import { ProductsModule } from '../products/products.module';
import { CustomersModule } from '../customers/customers.module';
import { PaymentAccountsModule } from '../payment-accounts/payment-accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { PlansModule } from '../plans/plans.module';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';

@Module({
  imports: [
    ProductsModule,
    CustomersModule,
    PaymentAccountsModule,
    TransactionsModule,
    MerchantsModule,
    PlansModule,
    FlutterwaveModule,
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrdersRepository, ExpireReservationsTask],
  exports: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
