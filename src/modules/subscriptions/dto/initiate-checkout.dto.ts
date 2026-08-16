import { IsUrl } from 'class-validator';

export class InitiateCheckoutDto {
  /** Where Flutterwave sends the merchant back after paying — dashboard owns its own callback route. */
  @IsUrl({ require_tld: false })
  redirectUrl!: string;
}
