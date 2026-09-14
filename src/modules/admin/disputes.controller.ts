import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';

class ListDisputesQueryDto {
  @IsOptional()
  @IsIn(['open', 'resolved'])
  status?: 'open' | 'resolved';

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

/** Manual dispute tracking — support handles these directly, same tier as domain provisioning. */
@Roles('admin', 'support')
@Controller('admin/disputes')
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async list(@Query() query: ListDisputesQueryDto) {
    return this.disputesService.list({ status: query.status, tenantId: query.tenantId });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.disputesService.getById(id);
  }

  @Post()
  async create(@Body() dto: CreateDisputeDto) {
    const dispute = await this.disputesService.create(dto);
    await this.auditService.log('dispute.created', 'dispute', dispute.id, {
      orderId: dispute.orderId,
    });
    return dispute;
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    const dispute = await this.disputesService.resolve(id, dto.resolutionNotes);
    await this.auditService.log('dispute.resolved', 'dispute', dispute.id);
    return dispute;
  }
}
