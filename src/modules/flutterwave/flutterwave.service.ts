import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { ServiceUnavailableError } from '../../common/errors';
import {
  CreateSubaccountInput,
  CreateSubaccountResult,
  FlutterwaveBank,
  InitializePaymentInput,
  InitializePaymentResult,
  RefundResult,
  TokenizedChargeInput,
  TokenizedChargeResult,
  VerifyTransactionResult,
} from './flutterwave.types';

const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Thin HTTP adapter over Flutterwave's v3 API. No domain knowledge lives
 * here — callers pass primitives in, get typed results out. Every method
 * throws ServiceUnavailableError on a non-2xx response or network failure;
 * callers decide what that means for their own flow.
 */
@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);

  constructor(private readonly config: AppConfigService) {}

  async createSubaccount(input: CreateSubaccountInput): Promise<CreateSubaccountResult> {
    const body = await this.request('/subaccounts', 'POST', {
      account_bank: input.accountBank,
      account_number: input.accountNumber,
      business_name: input.businessName,
      business_email: input.businessEmail,
      business_mobile: input.businessMobile,
      country: 'NG',
      split_type: 'percentage',
      split_value: input.defaultSplitPercent / 100,
    });

    const subaccountId = body?.data?.subaccount_id;
    if (!subaccountId) {
      throw new ServiceUnavailableError('Flutterwave did not return a subaccount id');
    }

    return { subaccountId };
  }

  /**
   * Hosted-checkout payment initialization. Used both for storefront sales
   * (split to a merchant subaccount) and for Cartr collecting a merchant's
   * own subscription charge (no split at all) — pass subaccountId/
   * platformChargePercent only for the former.
   */
  async initializePayment(input: InitializePaymentInput): Promise<InitializePaymentResult> {
    const body = await this.request('/payments', 'POST', {
      tx_ref: input.txRef,
      amount: input.amount,
      currency: input.currency,
      redirect_url: input.redirectUrl,
      customer: {
        email: input.customer.email,
        phonenumber: input.customer.phonenumber,
        name: input.customer.name,
      },
      ...(input.subaccountId
        ? {
            subaccounts: [
              {
                id: input.subaccountId,
                transaction_charge_type: 'percentage',
                transaction_charge: input.platformChargePercent,
              },
            ],
          }
        : {}),
    });

    const paymentLink = body?.data?.link;
    if (!paymentLink) {
      throw new ServiceUnavailableError('Flutterwave did not return a payment link');
    }

    return { paymentLink };
  }

  /**
   * Off-session charge against a previously-obtained card token — used for
   * subscription renewals. Defaults to requiring 3D Secure (an OTP only the
   * cardholder can complete) unless the account has NOAUTH approval from
   * Flutterwave, which is a support-approval process, not a code concern —
   * see README's subscription billing section. Callers must handle a
   * `pending` result (3DS challenge in flight) as a distinct outcome from
   * `failed`, not treat it as an error.
   */
  async tokenizedCharge(input: TokenizedChargeInput): Promise<TokenizedChargeResult> {
    const body = await this.request('/tokenized-charges', 'POST', {
      token: input.token,
      currency: input.currency,
      country: 'NG',
      amount: input.amount,
      email: input.email,
      tx_ref: input.txRef,
      narration: input.narration,
      redirect_url: input.redirectUrl,
    });

    const data = body?.data;
    if (!data) {
      throw new ServiceUnavailableError('Flutterwave tokenized charge response missing data');
    }

    return {
      flutterwaveTransactionId: String(data.id),
      status: data.status,
      // Field name for the 3DS redirect on a /tokenized-charges response
      // specifically was not confirmed against a real sandbox call — both
      // shapes seen in Flutterwave's docs across different endpoints are
      // checked defensively. Verify once real credentials exist.
      redirectUrl: data.meta?.authorization?.redirect ?? data.redirect_url,
    };
  }

  /**
   * Defense-in-depth check called from the webhook handler right before
   * money is marked settled — narrow retry (2 attempts) since a transient
   * blip here is worth a cheap extra try, unlike createSubaccount/
   * initializePayment where retrying risks duplicate side effects.
   */
  async verifyTransaction(
    flutterwaveTransactionId: string | number,
  ): Promise<VerifyTransactionResult> {
    return this.withRetry(async () => {
      const body = await this.request(`/transactions/${flutterwaveTransactionId}/verify`, 'GET');
      const data = body?.data;
      if (!data) {
        throw new ServiceUnavailableError('Flutterwave verify response missing data');
      }

      return {
        flutterwaveTransactionId: String(data.id),
        txRef: data.tx_ref,
        status: data.status,
        amount: Number(data.amount),
        currency: data.currency,
        card: data.card?.token
          ? {
              token: data.card.token,
              last4: data.card.last_4digits ?? data.card.last4 ?? '',
              type: data.card.type ?? data.card.card_type ?? '',
            }
          : undefined,
      };
    }, 2);
  }

  /**
   * Initiates a full refund of a completed transaction — no `amount` field
   * sent, which per Flutterwave's docs means a full refund (partial refunds
   * take an `amount` less than the original charge; not supported here).
   *
   * Deliberately NOT wrapped in withRetry, unlike verifyTransaction — a
   * refund is a mutating, non-idempotent call. Automatically retrying it
   * risks initiating a second real refund if the first response was merely
   * lost in transit, rather than the request never having reached Flutterwave.
   *
   * UNCONFIRMED (Flutterwave's docs say nothing about this): when the
   * original transaction used a subaccount split, it isn't documented
   * whether refunding claws back the merchant's subaccount share too, or
   * only reverses the platform's own cut. Do not assume either behavior in
   * production without confirming with Flutterwave support — see README.
   */
  async refund(flutterwaveTransactionId: string): Promise<RefundResult> {
    const body = await this.request(`/transactions/${flutterwaveTransactionId}/refund`, 'POST', {});

    const data = body?.data;
    if (!data?.id) {
      throw new ServiceUnavailableError('Flutterwave refund response missing data');
    }

    return {
      refundId: String(data.id),
      status: data.status,
      amountRefunded: Number(data.amount_refunded),
    };
  }

  async listBanks(): Promise<FlutterwaveBank[]> {
    const body = await this.request('/banks/NG', 'GET');
    const banks = body?.data ?? [];
    return banks.map((b: { code: string; name: string }) => ({ code: b.code, name: b.name }));
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          this.logger.warn(`Flutterwave call failed, retrying (${attempt}/${attempts})`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
    throw lastError;
  }

  private async request(path: string, method: 'GET' | 'POST', body?: unknown): Promise<any> {
    const url = `${this.config.flutterwaveBaseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.config.flutterwaveSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(`Flutterwave request to ${path} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableError('Unable to reach Flutterwave');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.error(`Flutterwave ${method} ${path} returned ${response.status}: ${text}`);
      throw new ServiceUnavailableError(`Flutterwave request failed (${response.status})`);
    }

    return response.json();
  }
}
