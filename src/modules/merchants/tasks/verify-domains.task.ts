import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MerchantsService } from '../merchants.service';

/**
 * In-process cron, same single-Coolify-instance rationale as
 * ExpireReservationsTask/RenewSubscriptionsTask — no distributed lock needed
 * until there's more than one instance. Retries every merchant with an
 * unverified custom domain still within CUSTOM_DOMAIN_VERIFICATION_TIMEOUT_DAYS
 * of requesting it (see MerchantsRepository.findPendingDomainVerifications).
 */
@Injectable()
export class VerifyDomainsTask {
  private readonly logger = new Logger(VerifyDomainsTask.name);

  constructor(private readonly merchantsService: MerchantsService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handle() {
    const { verified, stillPending } =
      await this.merchantsService.processPendingDomainVerifications();
    if (verified > 0 || stillPending > 0) {
      this.logger.log(`Domain verification: verified ${verified}, still pending ${stillPending}`);
    }
  }
}
