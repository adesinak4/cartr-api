import { Inject } from '@nestjs/common';
import { and, eq, SQL } from 'drizzle-orm';
import { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantContext } from './tenant-context';

/**
 * Base class for every repository whose table has a tenant_id column.
 * Every read/write method injects `WHERE tenant_id = <current tenant>` via
 * TenantContext — there is no method on this class that allows an unscoped
 * query. Concrete repositories must extend this instead of querying the
 * Drizzle client directly for tenant-owned tables.
 *
 * Generic over explicit Select/Insert row types (see BaseRepository for why —
 * same reasoning applies here).
 */
export abstract class TenantScopedRepository<
  TSelect extends { id: string; tenantId: string },
  TInsert,
> {
  constructor(
    @Inject(DRIZZLE_CLIENT) protected readonly db: DrizzleDb,
    protected readonly table: PgTable & { tenantId: PgColumn; id: PgColumn },
  ) {}

  private scopedWhere(extra?: SQL): SQL {
    const tenantId = TenantContext.requireTenantId();
    const tenantClause = eq(this.table.tenantId, tenantId);
    return extra ? (and(tenantClause, extra) as SQL) : tenantClause;
  }

  async findMany(extra?: SQL): Promise<TSelect[]> {
    return this.db.select().from(this.table).where(this.scopedWhere(extra)) as unknown as Promise<
      TSelect[]
    >;
  }

  async findById(id: string): Promise<TSelect | null> {
    const [row] = await this.db
      .select()
      .from(this.table)
      .where(this.scopedWhere(eq(this.table.id, id)))
      .limit(1);
    return (row as TSelect) ?? null;
  }

  async insertOne(values: Omit<TInsert, 'tenantId'>): Promise<TSelect> {
    const tenantId = TenantContext.requireTenantId();
    const [row] = await this.db
      .insert(this.table)
      .values({ ...values, tenantId } as any)
      .returning();
    return row as TSelect;
  }

  async updateById(
    id: string,
    values: Partial<Omit<TInsert, 'tenantId'>>,
  ): Promise<TSelect | null> {
    const [row] = await this.db
      .update(this.table)
      .set(values as any)
      .where(this.scopedWhere(eq(this.table.id, id)))
      .returning();
    return (row as TSelect) ?? null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = (await this.db
      .delete(this.table)
      .where(this.scopedWhere(eq(this.table.id, id)))) as unknown as { count: number };
    return result.count > 0;
  }
}
