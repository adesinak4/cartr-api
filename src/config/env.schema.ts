import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY_DAYS: z.coerce.number().int().min(1).default(7),

  FLUTTERWAVE_SECRET_KEY: z.string().min(1),
  FLUTTERWAVE_PUBLIC_KEY: z.string().min(1),
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: z.string().min(1),
  FLUTTERWAVE_BASE_URL: z.string().url().default('https://api.flutterwave.com/v3'),

  // How long a checkout holds reserved stock before the scheduled task
  // releases it back to inventory. Judgment call, not derived from anything
  // — easy to tune without a code change.
  ORDER_RESERVATION_TIMEOUT_MINUTES: z.coerce.number().int().min(1).default(30),

  // Subscription billing — all confirmed with the user as business-policy
  // defaults, not just arbitrary technical choices; see the billing plan.
  SUBSCRIPTION_TRIAL_DAYS: z.coerce.number().int().min(0).default(14),
  SUBSCRIPTION_GRACE_PERIOD_DAYS: z.coerce.number().int().min(1).default(7),
  SUBSCRIPTION_RENEWAL_RETRY_INTERVAL_DAYS: z.coerce.number().int().min(1).default(2),

  // How long the background cron keeps auto-retrying an unverified custom
  // domain before giving up (an on-demand check always still works past this).
  CUSTOM_DOMAIN_VERIFICATION_TIMEOUT_DAYS: z.coerce.number().int().min(1).default(7),

  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().min(8).optional(),

  // Dev-only — no merchant signup flow exists yet, this is how a local
  // frontend dev environment gets a real merchant + owner login.
  MERCHANT_SEED_EMAIL: z.string().email().optional(),
  MERCHANT_SEED_PASSWORD: z.string().min(8).optional(),
  MERCHANT_SEED_SLUG: z.string().optional(),
  MERCHANT_SEED_STORE_NAME: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): EnvConfig {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}
