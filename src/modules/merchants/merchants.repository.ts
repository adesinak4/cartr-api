import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, inArray, isNotNull, lte } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import { Merchant, merchants, NewMerchant } from '../../db/schema';
import { DomainAlreadyInUseError } from '../../common/errors';

const CUSTOM_DOMAIN_UNIQUE_CONSTRAINT = 'merchants_custom_domain_idx';

/**
 * Not tenant-scoped via TenantScopedRepository — `merchants` IS the tenant
 * table itself (its own `id` is the tenant id), so scoping doesn't apply the
 * same way it does to `products`/`orders`/etc.
 */
@Injectable()
export class MerchantsRepository extends BaseRepository<Merchant, NewMerchant> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, merchants);
  }

  async findBySlug(slug: string): Promise<Merchant | null> {
    const [row] = await this.db.select().from(merchants).where(eq(merchants.slug, slug)).limit(1);
    return row ?? null;
  }

  /** Only ever resolves a VERIFIED custom domain — see MerchantsService/verify-domains flow. */
  async findByCustomDomain(domain: string): Promise<Merchant | null> {
    const [row] = await this.db
      .select()
      .from(merchants)
      .where(and(eq(merchants.customDomain, domain), eq(merchants.customDomainVerified, true)))
      .limit(1);
    return row ?? null;
  }

  /** Used by the subscription renewal cron — merchants whose next charge/retry is due. */
  async findDueForRenewal(now: Date): Promise<Merchant[]> {
    return this.db
      .select()
      .from(merchants)
      .where(
        and(
          lte(merchants.nextRenewalAt, now),
          inArray(merchants.subscriptionStatus, ['trialing', 'active', 'past_due']),
          eq(merchants.accountStatus, 'active'), // never auto-charge an admin-suspended merchant
        ),
      );
  }

  /** Used by the domain-verification cron — merchants with an unverified domain still within the retry window. */
  async findPendingDomainVerifications(cutoff: Date): Promise<Merchant[]> {
    return this.db
      .select()
      .from(merchants)
      .where(
        and(
          isNotNull(merchants.customDomain),
          eq(merchants.customDomainVerified, false),
          gte(merchants.customDomainRequestedAt, cutoff),
          eq(merchants.accountStatus, 'active'),
        ),
      );
  }

  async markDomainVerified(id: string): Promise<Merchant | null> {
    const [row] = await this.db
      .update(merchants)
      .set({ customDomainVerified: true })
      .where(eq(merchants.id, id))
      .returning();
    return row ?? null;
  }

  /**
   * Overridden to translate the raw Postgres unique-constraint violation on
   * customDomain into a domain error — the DB unique index is the real
   * concurrency guard (no application-level check-then-act), this just wraps
   * the driver error at the infrastructure boundary rather than letting a raw
   * PostgresError leak up to the service layer.
   */
  async updateById(id: string, values: Partial<NewMerchant>): Promise<Merchant | null> {
    try {
      return await super.updateById(id, values);
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === '23505' &&
        'constraint_name' in err &&
        (err as { constraint_name: unknown }).constraint_name === CUSTOM_DOMAIN_UNIQUE_CONSTRAINT
      ) {
        throw new DomainAlreadyInUseError('This domain is already in use by another store');
      }
      throw err;
    }
  }
}
