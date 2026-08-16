export interface CreateSubaccountInput {
  accountBank: string; // ISO bank code, e.g. "044" — see FlutterwaveService.listBanks()
  accountNumber: string;
  businessName: string;
  businessEmail: string;
  businessMobile: string;
  /** Platform's cut, as a whole percentage (e.g. 5 for 5%) — used only as the
   *  subaccount's baked-in default; actual checkout always overrides this
   *  per-transaction from the merchant's current plan. */
  defaultSplitPercent: number;
}

export interface CreateSubaccountResult {
  subaccountId: string;
}

export interface InitializePaymentInput {
  txRef: string;
  amount: string;
  currency: string;
  redirectUrl: string;
  customer: {
    email?: string;
    phonenumber: string;
    name: string;
  };
  /**
   * Omit both split fields entirely for a charge with no split — e.g. Cartr
   * collecting a merchant's own subscription fee, as opposed to a storefront
   * sale being split between the platform and a merchant subaccount.
   */
  subaccountId?: string;
  /** Platform's cut for this specific transaction, as a whole percentage. */
  platformChargePercent?: number;
}

export interface InitializePaymentResult {
  paymentLink: string;
}

export interface VerifyTransactionResult {
  flutterwaveTransactionId: string;
  txRef: string;
  status: 'successful' | 'failed' | 'pending' | string;
  amount: number;
  currency: string;
  /**
   * Present when the underlying charge was a card payment. Used by the
   * subscription checkout flow to obtain a reusable token for later
   * off-session renewal charges — ignored by the order-checkout flow, which
   * never needs to charge a customer again after their one purchase.
   */
  card?: {
    token: string;
    last4: string;
    type: string;
  };
}

export interface FlutterwaveBank {
  code: string;
  name: string;
}

export interface FlutterwaveWebhookPayload {
  event: string;
  data: {
    id: number;
    tx_ref: string;
    flw_ref?: string;
    amount: number;
    currency: string;
    status: string;
  };
}

/**
 * Off-session charge against a previously-obtained card token — used for
 * subscription renewals, never for the initial charge (a token can only be
 * obtained FROM a completed charge, so the first charge always goes through
 * initializePayment's hosted checkout instead).
 */
export interface TokenizedChargeInput {
  token: string;
  amount: string;
  currency: string;
  email: string;
  txRef: string;
  narration: string;
  redirectUrl: string;
}

export interface TokenizedChargeResult {
  flutterwaveTransactionId: string;
  status: 'successful' | 'pending' | 'failed' | string;
  /** Present when status === 'pending' — a 3DS challenge the cardholder must complete. */
  redirectUrl?: string;
}

/**
 * Result of initiating a refund. Per Flutterwave's docs, even a "completed"
 * status here means the refund was accepted for processing, not that funds
 * have settled — settlement itself (1-15 days depending on rail) happens
 * entirely outside this response and isn't tracked by this codebase. Treat
 * `status` as an opaque provider string (their examples show values like
 * "completed-mpgs"), not a fixed enum to match exactly.
 */
export interface RefundResult {
  refundId: string;
  status: string;
  amountRefunded: number;
}
