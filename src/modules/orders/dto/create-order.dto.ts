import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateCustomerDto } from '../../customers/dto/create-customer.dto';

export class CreateOrderItemDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer!: CreateCustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsString()
  @MaxLength(500)
  deliveryStreet!: string;

  @IsString()
  @MaxLength(100)
  deliveryCity!: string;

  @IsString()
  @MaxLength(100)
  deliveryState!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /**
   * Where Flutterwave sends the customer back after paying — only used by
   * OrdersService.checkout(), not by the underlying order-creation logic
   * itself. Not stored on the order; the frontend owns its own callback route.
   */
  @IsUrl({ require_tld: false })
  redirectUrl!: string;
}
