import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateDisputeDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;
}
