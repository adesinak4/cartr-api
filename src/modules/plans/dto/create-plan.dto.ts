import { IsArray, IsNumberString, IsString, MaxLength, MinLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  /** Legacy monthly-equivalent fallback — see SubscriptionsService.resolveCharge. */
  @IsNumberString()
  monthlyPrice!: string;

  @IsNumberString()
  transactionFeePercent!: string;

  @IsArray()
  @IsString({ each: true })
  features!: string[];
}
