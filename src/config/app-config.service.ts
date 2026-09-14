import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './env.schema';

/**
 * Thin, typed wrapper around Nest's ConfigService so injection sites get
 * autocomplete instead of stringly-typed `.get('SOME_KEY')` calls.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvConfig, true>) {}

  get nodeEnv(): EnvConfig['NODE_ENV'] {
    return this.configService.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.configService.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('DATABASE_URL', { infer: true });
  }

  get redisUrl(): string {
    return this.configService.get('REDIS_URL', { infer: true });
  }

  get jwtAccessSecret(): string {
    return this.configService.get('JWT_ACCESS_SECRET', { infer: true });
  }

  get jwtRefreshSecret(): string {
    return this.configService.get('JWT_REFRESH_SECRET', { infer: true });
  }

  get jwtAccessExpiry(): string {
    return this.configService.get('JWT_ACCESS_EXPIRY', { infer: true });
  }

  get jwtRefreshExpiryDays(): number {
    return this.configService.get('JWT_REFRESH_EXPIRY_DAYS', { infer: true });
  }

  get adminSeedEmail(): string | undefined {
    return this.configService.get('ADMIN_SEED_EMAIL', { infer: true });
  }

  get adminSeedPassword(): string | undefined {
    return this.configService.get('ADMIN_SEED_PASSWORD', { infer: true });
  }

  get flutterwaveSecretKey(): string {
    return this.configService.get('FLUTTERWAVE_SECRET_KEY', { infer: true });
  }

  get flutterwavePublicKey(): string {
    return this.configService.get('FLUTTERWAVE_PUBLIC_KEY', { infer: true });
  }

  get flutterwaveWebhookSecretHash(): string {
    return this.configService.get('FLUTTERWAVE_WEBHOOK_SECRET_HASH', { infer: true });
  }

  get flutterwaveBaseUrl(): string {
    return this.configService.get('FLUTTERWAVE_BASE_URL', { infer: true });
  }

  get orderReservationTimeoutMinutes(): number {
    return this.configService.get('ORDER_RESERVATION_TIMEOUT_MINUTES', { infer: true });
  }

  get subscriptionTrialDays(): number {
    return this.configService.get('SUBSCRIPTION_TRIAL_DAYS', { infer: true });
  }

  get subscriptionGracePeriodDays(): number {
    return this.configService.get('SUBSCRIPTION_GRACE_PERIOD_DAYS', { infer: true });
  }

  get subscriptionRenewalRetryIntervalDays(): number {
    return this.configService.get('SUBSCRIPTION_RENEWAL_RETRY_INTERVAL_DAYS', { infer: true });
  }

  get customDomainVerificationTimeoutDays(): number {
    return this.configService.get('CUSTOM_DOMAIN_VERIFICATION_TIMEOUT_DAYS', { infer: true });
  }

  get googleClientId(): string | undefined {
    return this.configService.get('GOOGLE_CLIENT_ID', { infer: true });
  }
}
