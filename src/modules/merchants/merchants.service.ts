import { Injectable } from '@nestjs/common';
import { MerchantsRepository } from './merchants.repository';
import { ThemesService } from '../themes/themes.service';
import { PlansService } from '../plans/plans.service';
import { UsersRepository } from '../users/users.repository';
import { AuthService, LoginResult } from '../auth/auth.service';
import { checkCustomDomainTxtRecord, generateVerificationToken } from './domain-verification.util';
import { TenantContext } from '../../common/tenant/tenant-context';
import {
  NotFoundError,
  NoCustomDomainSetError,
  ThemeNotAllowedError,
  ConflictError,
} from '../../common/errors';
import { User, Merchant, NewMerchant } from '../../db/schema';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { AppConfigService } from '../../config/app-config.service';

const TRIAL_DAYS = 14;

const PREMIUM_THEMES_FEATURE = 'premium_themes';

interface PublicStorefront {
  slug: string;
  storeName: string;
  description: string | null;
  logoUrl: string | null;
  currency: string;
  isOpen: boolean;
  theme: { key: string; name: string } | null;
}

@Injectable()
export class MerchantsService {
  constructor(
    private readonly merchantsRepository: MerchantsRepository,
    private readonly themesService: ThemesService,
    private readonly plansService: PlansService,
    private readonly usersRepository: UsersRepository,
    private readonly authService: AuthService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Self-serve merchant registration — creates the tenant (merchant) row and
   * its owner user, then logs the new owner in immediately. Mirrors the
   * shape of scripts/seed-merchant.ts (the only prior way to get a real
   * merchant locally), formalized into a real, public endpoint.
   */
  async register(dto: RegisterMerchantDto): Promise<LoginResult> {
    const existingUser = await this.usersRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    const slug = await this.generateUniqueSlug(dto.storeName);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const merchant = await this.merchantsRepository.insertOne({
      slug,
      storeName: dto.storeName,
      accountStatus: 'active',
      subscriptionStatus: 'trialing',
      trialEndsAt,
      nextRenewalAt: trialEndsAt,
    });

    const passwordHash = await AuthService.hashPassword(dto.password);

    const user: User = await this.usersRepository.create({
      tenantId: merchant.id,
      email: dto.email,
      passwordHash,
      name: `${dto.firstName} ${dto.lastName}`.trim(),
      role: 'owner',
      status: 'active',
    });

    return this.authService.login(user);
  }

  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'store'
    );
  }

  private async generateUniqueSlug(storeName: string): Promise<string> {
    const base = this.slugify(storeName);
    let candidate = base;
    let suffix = 1;

    // The unique index on merchants.slug is the real guarantee under
    // concurrency; this just avoids the common case of an obviously
    // colliding slug on the happy path.
    while (await this.merchantsRepository.findBySlug(candidate)) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  async getCurrent(): Promise<Merchant> {
    const tenantId = TenantContext.requireTenantId();
    const merchant = await this.merchantsRepository.findById(tenantId);
    if (!merchant) throw new NotFoundError('Merchant not found');
    return merchant;
  }

  async updateCurrent(dto: UpdateMerchantDto): Promise<Merchant> {
    const tenantId = TenantContext.requireTenantId();
    const merchant = await this.getCurrent();

    const updates: Partial<NewMerchant> = { ...dto };

    if (dto.themeId) {
      await this.assertThemeAllowed(merchant, dto.themeId);
    }

    if (dto.customDomain && dto.customDomain !== merchant.customDomain) {
      updates.customDomainVerificationToken = generateVerificationToken();
      updates.customDomainVerified = false;
      updates.customDomainRequestedAt = new Date();
    }

    const updated = await this.merchantsRepository.updateById(tenantId, updates);
    if (!updated) throw new NotFoundError('Merchant not found');
    return updated;
  }

  async findBySlug(slug: string): Promise<Merchant | null> {
    return this.merchantsRepository.findBySlug(slug);
  }

  async findByCustomDomain(domain: string): Promise<Merchant | null> {
    return this.merchantsRepository.findByCustomDomain(domain);
  }

  /** Verified-only, same as findByCustomDomain — see resolve-domain route doc comment. */
  async resolveDomain(domain: string): Promise<{ slug: string }> {
    const merchant = await this.merchantsRepository.findByCustomDomain(domain);
    if (!merchant) throw new NotFoundError('Domain not found');
    return { slug: merchant.slug };
  }

  async getPublicStorefront(merchant: Merchant): Promise<PublicStorefront> {
    const theme = merchant.themeId ? await this.themesService.getById(merchant.themeId) : null;

    return {
      slug: merchant.slug,
      storeName: merchant.storeName,
      description: merchant.description,
      logoUrl: merchant.logoUrl,
      currency: merchant.currency,
      isOpen: merchant.isOpen,
      theme: theme ? { key: theme.key, name: theme.name } : null,
    };
  }

  /**
   * On-demand check — never throws for "still not verified yet", that's a
   * normal outcome of a status check, not an error. Only throws if there is
   * genuinely nothing to check. Idempotent no-op if already verified.
   */
  async verifyCustomDomainNow(): Promise<Merchant> {
    const merchant = await this.getCurrent();

    if (!merchant.customDomain) {
      throw new NoCustomDomainSetError('No custom domain has been set');
    }

    if (merchant.customDomainVerified) return merchant;

    const passed = await checkCustomDomainTxtRecord(
      merchant.customDomain,
      merchant.customDomainVerificationToken!,
    );

    if (!passed) return merchant;

    const verified = await this.merchantsRepository.markDomainVerified(merchant.id);
    return verified ?? merchant;
  }

  /** Called on a schedule (see tasks/verify-domains.task.ts). */
  async processPendingDomainVerifications(): Promise<{ verified: number; stillPending: number }> {
    const cutoff = new Date(
      Date.now() - this.config.customDomainVerificationTimeoutDays * 24 * 60 * 60 * 1000,
    );
    const pending = await this.merchantsRepository.findPendingDomainVerifications(cutoff);

    let verified = 0;
    let stillPending = 0;

    for (const merchant of pending) {
      const passed = await checkCustomDomainTxtRecord(
        merchant.customDomain!,
        merchant.customDomainVerificationToken!,
      );

      if (passed) {
        await this.merchantsRepository.markDomainVerified(merchant.id);
        verified++;
      } else {
        stillPending++;
      }
    }

    return { verified, stillPending };
  }

  /** Throws ThemeNotAllowedError unless the theme is free, or the merchant's plan includes 'premium_themes'. */
  private async assertThemeAllowed(merchant: Merchant, themeId: string): Promise<void> {
    const theme = await this.themesService.getById(themeId); // throws NotFoundError if missing

    if (!theme.isPremium) return;

    if (!merchant.planId) {
      throw new ThemeNotAllowedError('Your current plan does not include premium themes');
    }

    const plan = await this.plansService.getById(merchant.planId);
    if (!plan.features.includes(PREMIUM_THEMES_FEATURE)) {
      throw new ThemeNotAllowedError('Your current plan does not include premium themes');
    }
  }
}
