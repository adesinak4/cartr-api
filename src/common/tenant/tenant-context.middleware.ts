import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantContext } from './tenant-context';
import { NotFoundError, ForbiddenError } from '../errors';
import { MerchantsRepository } from '../../modules/merchants/merchants.repository';

/**
 * Resolves the tenant for PUBLIC, unauthenticated storefront requests (no JWT,
 * so no tenantId claim to read). Applied only to public storefront routes —
 * authenticated dashboard/admin requests get their tenant from
 * TenantContextInterceptor instead, based on the JWT payload.
 *
 * Resolution order: `:slug` route param first (e.g. /public/storefront/:slug),
 * falling back to the Host header for custom-domain requests (e.g.
 * zaracollections.com resolved without any slug in the path).
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(MerchantsRepository) private readonly merchantsRepository: MerchantsRepository,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const rawSlug = req.params?.slug;
    const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
    const host = req.hostname;

    const merchant = slug
      ? await this.merchantsRepository.findBySlug(slug)
      : await this.merchantsRepository.findByCustomDomain(host);

    if (!merchant) {
      throw new NotFoundError('Store not found');
    }

    if (merchant.accountStatus === 'suspended') {
      throw new ForbiddenError('This store is currently unavailable');
    }

    // Distinct from admin suspension above: this is non-payment of the
    // Cartr subscription fee, not an admin action. Deliberately only checked
    // here (public storefront) — TenantContextInterceptor (authenticated
    // dashboard) is untouched, since the merchant must still be able to log
    // in and pay to recover from this state.
    if (merchant.subscriptionStatus === 'cancelled') {
      throw new ForbiddenError('This store is currently unavailable');
    }

    TenantContext.run({ tenantId: merchant.id, userId: null, role: null }, () => {
      (req as any).merchant = merchant;
      next();
    });
  }
}
