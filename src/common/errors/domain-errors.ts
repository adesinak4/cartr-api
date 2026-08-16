import { HttpStatus } from '@nestjs/common';
import { AppError } from './app-error';

export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly httpStatus = HttpStatus.NOT_FOUND;
}

export class ConflictError extends AppError {
  readonly code = 'CONFLICT';
  readonly httpStatus = HttpStatus.CONFLICT;
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = HttpStatus.BAD_REQUEST;
}

export class UnauthorizedError extends AppError {
  readonly code = 'UNAUTHORIZED';
  readonly httpStatus = HttpStatus.UNAUTHORIZED;
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = HttpStatus.FORBIDDEN;
}

export class TenantMismatchError extends AppError {
  readonly code = 'TENANT_MISMATCH';
  readonly httpStatus = HttpStatus.FORBIDDEN;
}

export class ServiceUnavailableError extends AppError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly httpStatus = HttpStatus.SERVICE_UNAVAILABLE;
}

/** Checkout is well-formed but blocked by merchant-side state (no payout account, no plan, etc). */
export class PayoutAccountNotReadyError extends AppError {
  readonly code = 'PAYOUT_ACCOUNT_NOT_READY';
  readonly httpStatus = HttpStatus.CONFLICT;
}

/** One or more order items couldn't be reserved atomically — someone else's checkout won the race. */
export class InsufficientStockError extends AppError {
  readonly code = 'INSUFFICIENT_STOCK';
  readonly httpStatus = HttpStatus.CONFLICT;
}

/** A merchant tried to select a theme their plan doesn't allow (e.g. a premium theme with no qualifying plan). */
export class ThemeNotAllowedError extends AppError {
  readonly code = 'THEME_NOT_ALLOWED';
  readonly httpStatus = HttpStatus.FORBIDDEN;
}

/** Another merchant already owns/has claimed this custom domain (unique constraint on merchants.customDomain). */
export class DomainAlreadyInUseError extends AppError {
  readonly code = 'DOMAIN_ALREADY_IN_USE';
  readonly httpStatus = HttpStatus.CONFLICT;
}

/** Verification was requested but the merchant has no customDomain set. */
export class NoCustomDomainSetError extends AppError {
  readonly code = 'NO_CUSTOM_DOMAIN_SET';
  readonly httpStatus = HttpStatus.CONFLICT;
}

/** Covers every reason an order/transaction can't be refunded right now — wrong status, no successful payment, missing provider reference, already refunded. */
export class TransactionNotRefundableError extends AppError {
  readonly code = 'TRANSACTION_NOT_REFUNDABLE';
  readonly httpStatus = HttpStatus.CONFLICT;
}
