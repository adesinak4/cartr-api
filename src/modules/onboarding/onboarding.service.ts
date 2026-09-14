import { Injectable, Logger } from '@nestjs/common';
import { SignupDraftsRepository } from './signup-drafts.repository';
import { DomainProvisioningTasksRepository } from './domain-provisioning-tasks.repository';
import { PlansService } from '../plans/plans.service';
import { MerchantsService } from '../merchants/merchants.service';
import { MerchantsRepository } from '../merchants/merchants.repository';
import { UsersRepository } from '../users/users.repository';
import { AuthService, LoginResult } from '../auth/auth.service';
import { GoogleAuthService } from '../auth/google-auth.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { SignupCheckoutDto } from './dto/signup-checkout.dto';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../common/errors';
import { Merchant, SignupDraft } from '../../db/schema';
import { FlutterwaveWebhookPayload } from '../flutterwave/flutterwave.types';

const DRAFT_TTL_HOURS = 48;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly signupDraftsRepository: SignupDraftsRepository,
    private readonly domainProvisioningTasksRepository: DomainProvisioningTasksRepository,
    private readonly plansService: PlansService,
    private readonly merchantsService: MerchantsService,
    private readonly merchantsRepository: MerchantsRepository,
    private readonly usersRepository: UsersRepository,
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly flutterwaveService: FlutterwaveService,
  ) {}

  /**
   * Creates the wizard's in-flight draft and starts a real Flutterwave
   * checkout for it — no merchant/user row exists yet, and won't until
   * handleChargeWebhook confirms payment. The draft's own id is used as the
   * tx_ref, which is how the webhook finds its way back here.
   */
  async startCheckout(dto: SignupCheckoutDto): Promise<{ paymentLink: string; draftId: string }> {
    const existingUser = await this.usersRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictError('An account with this email already exists');
    }

    // Throws NotFoundError if this plan/period combo has no price configured
    // — fail before creating a draft or charging anything, not after.
    const price = await this.plansService.getPrice(dto.planId, dto.periodMonths);

    const hasPassword = !!dto.password;
    const hasGoogleToken = !!dto.googleIdToken;
    if (hasPassword === hasGoogleToken) {
      throw new ValidationError('Provide exactly one of password or googleIdToken');
    }

    let passwordHash: string | undefined;
    let googleId: string | undefined;

    if (dto.googleIdToken) {
      const profile = await this.googleAuthService.verifyIdToken(dto.googleIdToken);
      // Cross-check against the submitted email rather than trusting the
      // token's email to silently override it — a mismatch here means the
      // frontend sent a token for a different account than the form shows.
      if (profile.email !== dto.email) {
        throw new ValidationError('Google account email does not match the signup email');
      }
      googleId = profile.googleId;
    } else {
      passwordHash = await AuthService.hashPassword(dto.password!);
    }

    const draft = await this.signupDraftsRepository.insertOne({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      googleId,
      storeName: dto.storeName,
      domain: dto.domain,
      planId: dto.planId,
      periodMonths: dto.periodMonths,
      themeId: dto.themeId,
      expiresAt: new Date(Date.now() + DRAFT_TTL_HOURS * 60 * 60 * 1000),
    });

    const { paymentLink } = await this.flutterwaveService.initializePayment({
      txRef: draft.id,
      amount: price.totalPrice,
      currency: 'NGN',
      redirectUrl: dto.redirectUrl,
      customer: {
        name: `${dto.firstName} ${dto.lastName}`.trim(),
        email: dto.email,
        phonenumber: dto.phone,
      },
      // No subaccountId/platformChargePercent — this is Cartr collecting
      // the subscription payment directly, not a split storefront sale.
    });

    return { paymentLink, draftId: draft.id };
  }

  async getStatus(draftId: string): Promise<{ status: string; slug: string | null }> {
    const draft = await this.signupDraftsRepository.findById(draftId);
    if (!draft) throw new NotFoundError('Signup not found');

    if (draft.status !== 'completed' || !draft.merchantId) {
      return { status: draft.status, slug: null };
    }

    const merchant = await this.merchantsRepository.findById(draft.merchantId);
    return { status: draft.status, slug: merchant?.slug ?? null };
  }

  /**
   * Webhook fallthrough handler — same contract as
   * SubscriptionsService.handleChargeWebhook: true once handled (success,
   * failure, or idempotent no-op), false for a tx_ref this doesn't
   * recognize at all, so the caller can log it as genuinely unknown.
   */
  async handleChargeWebhook(payload: FlutterwaveWebhookPayload): Promise<boolean> {
    const draft = await this.signupDraftsRepository.findById(payload.data.tx_ref);
    if (!draft) return false;

    if (draft.status !== 'pending') return true; // idempotent no-op — already resolved

    const verified = await this.flutterwaveService.verifyTransaction(payload.data.id);
    const price = await this.plansService.getPrice(draft.planId, draft.periodMonths);
    const amountMatches = verified.amount === Number(price.totalPrice);

    if (verified.status !== 'successful' || !amountMatches) {
      await this.signupDraftsRepository.markFailed(draft.id);
      this.logger.warn(`Signup draft ${draft.id} payment verification failed or amount mismatch`);
      return true;
    }

    const merchant = await this.createMerchantFromDraft(draft);
    await this.signupDraftsRepository.markCompleted(draft.id, merchant.id);

    await this.domainProvisioningTasksRepository.insertOne({
      merchantId: merchant.id,
      desiredDomain: draft.domain,
    });

    this.logger.log(
      `New merchant onboarded via signup draft ${draft.id}: "${merchant.slug}" — ` +
        `domain "${draft.domain}" queued for manual Truehost provisioning`,
    );

    return true;
  }

  /**
   * Single-use — exchanges a completed draft for a real session (same shape
   * as AuthService.login). The draft's id itself is the token; see
   * signup-drafts.schema.ts for why that's safe here (server-issued,
   * short-lived, single-use, never transmitted except in the redirect URL
   * Flutterwave itself sends the browser to).
   */
  async exchangeForLogin(draftId: string): Promise<LoginResult> {
    const draft = await this.signupDraftsRepository.findById(draftId);
    if (!draft || draft.status !== 'completed' || !draft.merchantId) {
      throw new NotFoundError('This signup is not ready yet');
    }

    const claimed = await this.signupDraftsRepository.consumeLoginToken(draftId);
    if (!claimed) {
      throw new UnauthorizedError('This signup link has already been used');
    }

    const user = await this.usersRepository.findOwnerByTenantId(draft.merchantId);
    if (!user) throw new NotFoundError('Owner account not found');

    return this.authService.login(user);
  }

  private async createMerchantFromDraft(draft: SignupDraft): Promise<Merchant> {
    // draft.domain is already a validated second-level label (no TLD) —
    // reused directly as the slug base rather than re-deriving from
    // storeName, since the domain IS the merchant's public identity now.
    const slug = await this.merchantsService.ensureUniqueSlug(draft.domain);

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + draft.periodMonths);

    const merchant = await this.merchantsRepository.insertOne({
      slug,
      storeName: draft.storeName,
      accountStatus: 'active',
      // Paid upfront, no trial in this flow — see the pricing/no-trial decision.
      subscriptionStatus: 'active',
      planId: draft.planId,
      billingPeriodMonths: draft.periodMonths,
      themeId: draft.themeId ?? undefined,
      currentPeriodEnd: periodEnd,
      nextRenewalAt: periodEnd,
    });

    await this.usersRepository.create({
      tenantId: merchant.id,
      email: draft.email,
      phone: draft.phone,
      passwordHash: draft.passwordHash,
      googleId: draft.googleId,
      name: `${draft.firstName} ${draft.lastName}`.trim(),
      role: 'owner',
      status: 'active',
    });

    return merchant;
  }
}
