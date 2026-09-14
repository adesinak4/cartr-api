import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { SignupCheckoutDto } from './dto/signup-checkout.dto';
import { Public } from '../../common/decorators/public.decorator';

/** Fully public — this is how a merchant is created in the first place, before any session exists. */
@Public()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('checkout')
  async startCheckout(@Body() dto: SignupCheckoutDto) {
    return this.onboardingService.startCheckout(dto);
  }

  @Get(':draftId/status')
  async getStatus(@Param('draftId') draftId: string) {
    return this.onboardingService.getStatus(draftId);
  }

  /** Single-use — the wizard's confirmation page calls this once to exchange the completed draft for a real session. */
  @Post(':draftId/login')
  async exchangeForLogin(@Param('draftId') draftId: string) {
    return this.onboardingService.exchangeForLogin(draftId);
  }
}
