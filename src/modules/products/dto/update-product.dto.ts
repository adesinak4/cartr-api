import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { CreateProductDto } from './create-product.dto';

const PRODUCT_STATUSES = ['active', 'draft', 'archived'] as const;

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];
}
