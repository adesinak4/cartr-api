import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from '../orders.service';

/**
 * In-process cron (no job queue in this codebase yet, and this is a single
 * Coolify instance — no distributed-lock concern to solve for right now).
 * Releases stock reserved by checkouts that never completed payment, so a
 * reservation doesn't hold inventory hostage forever. See
 * OrdersService.expireStaleReservations for the actual release logic and
 * ORDER_RESERVATION_TIMEOUT_MINUTES for how long a reservation is held.
 */
@Injectable()
export class ExpireReservationsTask {
  private readonly logger = new Logger(ExpireReservationsTask.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle() {
    const { released, failed } = await this.ordersService.expireStaleReservations();
    if (released > 0 || failed > 0) {
      this.logger.log(`Reservation expiry: released ${released}, failed ${failed}`);
    }
  }
}
