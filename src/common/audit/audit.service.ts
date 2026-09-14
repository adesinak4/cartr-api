import { Injectable } from '@nestjs/common';
import { AuditLogRepository, AuditLogFilter } from './audit-log.repository';
import { TenantContext } from '../tenant/tenant-context';
import { AuditLog } from '../../db/schema';

/**
 * Thin wrapper so call sites never have to thread the acting user through —
 * TenantContext already carries it for every authenticated request.
 */
@Injectable()
export class AuditService {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async log(
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const actor = TenantContext.get();

    await this.auditLogRepository.record({
      action,
      entityType,
      entityId,
      actorId: actor?.userId ?? null,
      actorRole: actor?.role ?? null,
      metadata,
    });
  }

  async list(filter: AuditLogFilter = {}): Promise<AuditLog[]> {
    return this.auditLogRepository.findMany(filter);
  }
}
