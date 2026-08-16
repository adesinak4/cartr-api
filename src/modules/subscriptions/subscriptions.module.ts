import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentMethodsRepository } from './payment-methods.repository';
import { SubscriptionChargesRepository } from './subscription-charges.repository';
import { RenewSubscriptionsTask } from './tasks/renew-subscriptions.task';
import { MerchantsModule } from '../merchants/merchants.module';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';

@Module({
  imports: [MerchantsModule, PlansModule, UsersModule, FlutterwaveModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    PaymentMethodsRepository,
    SubscriptionChargesRepository,
    RenewSubscriptionsTask,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
