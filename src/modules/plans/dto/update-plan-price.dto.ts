import { IsIn, IsNumberString } from 'class-validator';

export class UpdatePlanPriceDto {
  @IsIn([3, 6, 12])
  periodMonths!: number;

  @IsNumberString()
  totalPrice!: string;
}
