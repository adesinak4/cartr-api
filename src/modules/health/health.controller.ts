import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import Redis from 'ioredis';
import { Public } from '../../common/decorators/public.decorator';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { ServiceUnavailableError } from '../../common/errors';

interface CheckResult {
  name: string;
  status: 'ok' | 'error';
  message?: string;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Is the process alive? Never checks dependencies. */
  @Public()
  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  /**
   * Is this instance ready to receive traffic? Checks all critical dependencies.
   * Throws (rather than manually setting a response status) so the failure
   * flows through the same GlobalExceptionFilter path as every other error in
   * the app — keeping the HTTP status and the response envelope's `status`
   * field consistent instead of returning a 503 body that claims "success".
   */
  @Public()
  @Get('ready')
  async ready() {
    const [dbCheck, redisCheck] = await Promise.all([this.checkDb(), this.checkRedis()]);
    const checks = [dbCheck, redisCheck];
    const isReady = checks.every((c) => c.status === 'ok');

    if (!isReady) {
      throw new ServiceUnavailableError('One or more dependencies are unavailable', { checks });
    }

    return { status: 'ok', checks };
  }

  private async checkDb(): Promise<CheckResult> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { name: 'database', status: 'ok' };
    } catch (err) {
      return { name: 'database', status: 'error', message: (err as Error).message };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    try {
      await this.redis.ping();
      return { name: 'redis', status: 'ok' };
    } catch (err) {
      return { name: 'redis', status: 'error', message: (err as Error).message };
    }
  }
}
