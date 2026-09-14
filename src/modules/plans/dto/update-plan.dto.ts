import {
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumberString()
  monthlyPrice?: string;

  @IsOptional()
  @IsNumberString()
  transactionFeePercent?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}
