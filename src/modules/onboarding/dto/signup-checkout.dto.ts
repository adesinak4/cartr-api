import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupCheckoutDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  @Matches(/^[0-9+\-() ]+$/, { message: 'phone must be a valid phone number' })
  phone!: string;

  /** Exactly one of password/googleIdToken must be provided — enforced in OnboardingService. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  /** Google Identity Services ID token — signup via "Continue with Google" instead of a password. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  googleIdToken?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  storeName!: string;

  /** Second-level label only, e.g. "zaracollections" — never the full domain with TLD. */
  @IsString()
  @MinLength(1)
  @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/i, {
    message: 'domain must contain only letters, numbers, and hyphens',
  })
  domain!: string;

  @IsUUID()
  planId!: string;

  @IsIn([3, 6, 12])
  periodMonths!: number;

  @IsOptional()
  @IsUUID()
  themeId?: string;

  /** Where Flutterwave sends the browser back — the wizard's own confirmation page. */
  @IsUrl({ require_tld: false })
  redirectUrl!: string;
}
