import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuditLogsController } from './audit-logs.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminDomainProvisioningController } from './admin-domain-provisioning.controller';
import { AdminStatsController } from './admin-stats.controller';
import { DisputesController } from './disputes.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { AdminService } from './admin.service';
import { AdminUsersService } from './admin-users.service';
import { AdminStatsService } from './admin-stats.service';
import { DisputesService } from './disputes.service';
import { DisputesRepository } from './disputes.repository';
import { PlatformSettingsRepository } from './platform-settings.repository';
import { AdminSeedService } from './admin-seed.service';
import { MerchantsModule } from '../merchants/merchants.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { OrdersModule } from '../orders/orders.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    MerchantsModule,
    UsersModule,
    AuthModule,
    OnboardingModule,
    OrdersModule,
    SubscriptionsModule,
  ],
  controllers: [
    AdminController,
    AuditLogsController,
    AdminUsersController,
    AdminDomainProvisioningController,
    AdminStatsController,
    DisputesController,
    PlatformSettingsController,
  ],
  providers: [
    AdminService,
    AdminUsersService,
    AdminStatsService,
    DisputesService,
    DisputesRepository,
    PlatformSettingsRepository,
    AdminSeedService,
  ],
})
export class AdminModule {}
