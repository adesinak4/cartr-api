import { IsEmail, IsString, MaxLength } from 'class-validator';

export class CreatePaymentAccountDto {
  @IsString()
  @MaxLength(255)
  bankName!: string;

  /** ISO bank code — see GET /payment-accounts/banks for the valid list. */
  @IsString()
  @MaxLength(10)
  bankCode!: string;

  @IsString()
  @MaxLength(50)
  accountNumber!: string;

  @IsString()
  @MaxLength(255)
  accountName!: string;

  /** Required by Flutterwave's subaccount creation, sourced fresh from this form. */
  @IsEmail()
  businessEmail!: string;

  @IsString()
  @MaxLength(20)
  businessMobile!: string;
}
