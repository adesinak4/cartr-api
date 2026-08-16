import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller';
import { MerchantsService } from './merchants.service';
import { MerchantsRepository } from './merchants.repository';
import { ThemesModule } from '../themes/themes.module';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { VerifyDomainsTask } from './tasks/verify-domains.task';

@Module({
  imports: [ThemesModule, PlansModule, UsersModule, AuthModule],
  controllers: [MerchantsController],
  providers: [MerchantsService, MerchantsRepository, VerifyDomainsTask],
  exports: [MerchantsService, MerchantsRepository],
})
export class MerchantsModule {}
