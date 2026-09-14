import { Injectable } from '@nestjs/common';
import { PaymentAccountsRepository } from './payment-accounts.repository';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { MerchantsService } from '../merchants/merchants.service';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { ConflictError, NotFoundError, PayoutAccountNotReadyError } from '../../common/errors';
import { PaymentAccount } from '../../db/schema';
import { FlutterwaveBank } from '../flutterwave/flutterwave.types';

// Baked into the subaccount at creation time as a fallback — actual checkout
// always overrides the split per-transaction from the merchant's current plan
// (see OrdersService.checkout), so this default is rarely load-bearing.
const DEFAULT_SPLIT_PERCENT = 5;

@Injectable()
export class PaymentAccountsService {
  constructor(
    private readonly paymentAccountsRepository: PaymentAccountsRepository,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly merchantsService: MerchantsService,
  ) {}

  async getCurrent(): Promise<PaymentAccount> {
    const account = await this.paymentAccountsRepository.findForCurrentTenant();
    if (!account) throw new NotFoundError('No payout account on file');
    return account;
  }

  /** Checkout's hard gate — a merchant can't accept payment until this passes. */
  async requireReadyForCheckout(): Promise<PaymentAccount> {
    const account = await this.paymentAccountsRepository.findForCurrentTenant();
    if (!account || !account.providerSubaccountId) {
      throw new PayoutAccountNotReadyError(
        'This store has not finished setting up how it gets paid yet',
      );
    }
    return account;
  }

  async listBanks(): Promise<FlutterwaveBank[]> {
    return this.flutterwaveService.listBanks();
  }

  async resolveAccount(bankCode: string, accountNumber: string) {
    return this.flutterwaveService.resolveAccount(bankCode, accountNumber);
  }

  /**
   * Registers the merchant's payout destination — creates a real Flutterwave
   * subaccount and stores its id. No local row is written if the Flutterwave
   * call fails (no partial state), matching the atomicity discipline used
   * elsewhere in this codebase (see OrdersRepository.createWithItems).
   */
  async create(dto: CreatePaymentAccountDto): Promise<PaymentAccount> {
    const existing = await this.paymentAccountsRepository.findForCurrentTenant();
    if (existing) {
      throw new ConflictError('A payout account already exists for this store');
    }

    const merchant = await this.merchantsService.getCurrent();

    const { subaccountId } = await this.flutterwaveService.createSubaccount({
      accountBank: dto.bankCode,
      accountNumber: dto.accountNumber,
      businessName: merchant.storeName,
      businessEmail: dto.businessEmail,
      businessMobile: dto.businessMobile,
      defaultSplitPercent: DEFAULT_SPLIT_PERCENT,
    });

    return this.paymentAccountsRepository.insertOne({
      bankName: dto.bankName,
      bankCode: dto.bankCode,
      accountNumber: dto.accountNumber,
      accountName: dto.accountName,
      provider: 'flutterwave',
      providerSubaccountId: subaccountId,
      // Flutterwave's subaccount API gives no separate async verification
      // step — success here is the whole contract, so this is set eagerly.
      // See the "kycStatus" note in the payments integration plan for the
      // one open question this simplifies past: whether Flutterwave does a
      // separate compliance review out-of-band that this doesn't see.
      kycStatus: 'verified',
      verifiedAt: new Date(),
    });
  }
}
