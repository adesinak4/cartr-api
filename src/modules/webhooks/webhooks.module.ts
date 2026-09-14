import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

@Module({
  imports: [
    FlutterwaveModule,
    TransactionsModule,
    OrdersModule,
    SubscriptionsModule,
    OnboardingModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
