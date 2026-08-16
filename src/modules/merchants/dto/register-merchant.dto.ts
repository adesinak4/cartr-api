import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterMerchantDto {
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

  // Accepted for a familiar signup form, but there is no schema column for
  // it yet (users/merchants have no phone field) — intentionally not
  // persisted rather than silently smuggled into an unrelated column.
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  storeName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
