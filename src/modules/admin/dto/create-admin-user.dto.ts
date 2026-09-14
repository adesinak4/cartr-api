import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

/** Creates a platform-level user (tenantId null) — 'admin' or 'support' only, never a merchant role. */
export class CreateAdminUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsIn(['admin', 'support'])
  role!: 'admin' | 'support';
}
