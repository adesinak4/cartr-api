import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, SQL } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { auditLogs, AuditLog, NewAuditLog } from '../../db/schema';

export interface AuditLogFilter {
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Purpose-built, not extending BaseRepository/TenantScopedRepository —
 * audit rows are append-only (no updateById) and platform-wide (no implicit
 * tenant scoping, since a 'support'/'admin' actor has no single tenant).
 */
@Injectable()
export class AuditLogRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async record(entry: NewAuditLog): Promise<AuditLog> {
    const [row] = await this.db.insert(auditLogs).values(entry).returning();
    return row;
  }

  async findMany(filter: AuditLogFilter = {}): Promise<AuditLog[]> {
    const clauses: SQL[] = [];
    if (filter.entityType) clauses.push(eq(auditLogs.entityType, filter.entityType));
    if (filter.entityId) clauses.push(eq(auditLogs.entityId, filter.entityId));

    return this.db
      .select()
      .from(auditLogs)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);
  }
}
