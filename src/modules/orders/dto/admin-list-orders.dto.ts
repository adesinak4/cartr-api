import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AdminListOrdersDto {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'])
  status?: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
