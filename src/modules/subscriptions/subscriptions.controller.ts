import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { InitiateCheckoutDto } from './dto/initiate-checkout.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@Roles('owner')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('me')
  async getCurrent() {
    return this.subscriptionsService.getCurrent();
  }

  /** Same endpoint serves the first charge (trial → active) and self-service recovery from past_due. */
  @Post('checkout')
  async initiateCheckout(@Body() dto: InitiateCheckoutDto) {
    return this.subscriptionsService.initiateCheckout(dto.redirectUrl);
  }

  @Patch('plan')
  async changePlan(@Body() dto: ChangePlanDto) {
    await this.subscriptionsService.changePlan(dto.planId);
    return null; // global ResponseEnvelopeInterceptor coerces this to { status: 'success', data: null }
  }
}
