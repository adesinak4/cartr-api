import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from '../subscriptions.service';

/**
 * In-process cron, same single-Coolify-instance rationale as
 * ExpireReservationsTask — no distributed lock needed until there's more
 * than one instance. Charges every merchant whose nextRenewalAt has passed
 * (first charge, on-schedule renewal, or a dunning retry — all the same
 * "due" query, see MerchantsRepository.findDueForRenewal).
 */
@Injectable()
export class RenewSubscriptionsTask {
  private readonly logger = new Logger(RenewSubscriptionsTask.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handle() {
    const { charged, failed } = await this.subscriptionsService.processDueRenewals();
    if (charged > 0 || failed > 0) {
      this.logger.log(`Subscription renewal: charged ${charged}, failed ${failed}`);
    }
  }
}
