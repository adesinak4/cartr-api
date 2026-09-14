import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { SignupDraftsRepository } from './signup-drafts.repository';
import { DomainProvisioningTasksRepository } from './domain-provisioning-tasks.repository';
import { PlansModule } from '../plans/plans.module';
import { MerchantsModule } from '../merchants/merchants.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';

@Module({
  imports: [PlansModule, MerchantsModule, UsersModule, AuthModule, FlutterwaveModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, SignupDraftsRepository, DomainProvisioningTasksRepository],
  // DomainProvisioningTasksRepository exported for admin's queue view/actions.
  exports: [OnboardingService, DomainProvisioningTasksRepository],
})
export class OnboardingModule {}
