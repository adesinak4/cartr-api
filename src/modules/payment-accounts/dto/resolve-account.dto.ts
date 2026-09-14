import { IsString, MaxLength } from 'class-validator';

export class ResolveAccountDto {
  @IsString()
  @MaxLength(10)
  bankCode!: string;

  @IsString()
  @MaxLength(50)
  accountNumber!: string;
}
