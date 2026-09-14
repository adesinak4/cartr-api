import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class AdminListTransactionsDto {
  @IsOptional()
  @IsIn(['pending', 'success', 'failed', 'refunded'])
  status?: 'pending' | 'success' | 'failed' | 'refunded';

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
