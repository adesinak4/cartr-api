import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from './common/logger/logger.module';
import { EventsModule } from './common/events/events.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { TenantContextInterceptor } from './common/tenant/tenant-context.interceptor';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { ProductsModule } from './modules/products/products.module';
import { CustomersModule } from './modules/customers/customers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PlansModule } from './modules/plans/plans.module';
import { ThemesModule } from './modules/themes/themes.module';
import { PaymentAccountsModule } from './modules/payment-accounts/payment-accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AdminModule } from './modules/admin/admin.module';
import { FlutterwaveModule } from './modules/flutterwave/flutterwave.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    EventsModule,
    ScheduleModule.forRoot(),
    DbModule,
    RedisModule,
    AuthModule,
    UsersModule,
    HealthModule,
    MerchantsModule,
    ProductsModule,
    CustomersModule,
    OrdersModule,
    PlansModule,
    ThemesModule,
    PaymentAccountsModule,
    TransactionsModule,
    AdminModule,
    FlutterwaveModule,
    WebhooksModule,
    SubscriptionsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Public storefront resolution — every unauthenticated, tenant-scoped
    // route (browsing + checkout) resolves its tenant here from :slug rather
    // than from a JWT.
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes(
        { path: 'merchants/public/storefront/:slug', method: RequestMethod.GET },
        { path: 'orders/public/storefront/:slug/checkout', method: RequestMethod.POST },
        { path: 'products/public/storefront/:slug', method: RequestMethod.GET },
        { path: 'products/public/storefront/:slug/:productId', method: RequestMethod.GET },
      );
  }
}
