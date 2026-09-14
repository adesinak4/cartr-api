import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { DomainProvisioningTasksRepository } from '../onboarding/domain-provisioning-tasks.repository';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { NotFoundError, ValidationError } from '../../common/errors';
import { IsIn, IsOptional } from 'class-validator';

class ListDomainProvisioningQueryDto {
  @IsOptional()
  @IsIn(['pending', 'done'])
  status?: 'pending' | 'done';
}

/**
 * The manual-registration queue every real signup lands in — see the
 * domain-architecture decision (Truehost registration + DNS is ops-driven,
 * not automated). Marking a task done here is the entire "operation" this
 * queue exists to support — support tier can do it, not just view it.
 */
@Roles('admin', 'support')
@Controller('admin/domain-provisioning')
export class AdminDomainProvisioningController {
  constructor(
    private readonly domainProvisioningTasksRepository: DomainProvisioningTasksRepository,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async list(@Query() query: ListDomainProvisioningQueryDto) {
    return this.domainProvisioningTasksRepository.listWithMerchant(query.status);
  }

  @Patch(':id/done')
  async markDone(@Param('id') id: string) {
    const task = await this.domainProvisioningTasksRepository.findById(id);
    if (!task) throw new NotFoundError('Domain provisioning task not found');
    if (task.status === 'done') {
      throw new ValidationError('This task is already marked done');
    }

    const updated = await this.domainProvisioningTasksRepository.updateById(id, {
      status: 'done',
      doneAt: new Date(),
    });

    await this.auditService.log('domain_provisioning.done', 'domain_provisioning_task', id, {
      domain: task.desiredDomain,
    });

    return updated;
  }
}
