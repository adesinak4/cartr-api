import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE_CLIENT, DrizzleDb } from './db.module';

/**
 * Base CRUD helper for tables that are NOT tenant-scoped (e.g. plans, themes,
 * merchants itself). For tenant-scoped tables, use TenantScopedRepository
 * instead — see src/common/tenant/tenant-scoped.repository.ts.
 *
 * Generic over explicit Select/Insert row types (declared per-table in the
 * schema files) rather than derived from the table's own generic parameters —
 * Drizzle's table typing is too structurally strict to make that ergonomic
 * across an abstract base class.
 */
export abstract class BaseRepository<TSelect extends { id: string }, TInsert> {
  constructor(
    @Inject(DRIZZLE_CLIENT) protected readonly db: DrizzleDb,
    protected readonly table: PgTable,
  ) {}

  async findMany(): Promise<TSelect[]> {
    return this.db.select().from(this.table) as unknown as Promise<TSelect[]>;
  }

  async findById(id: string): Promise<TSelect | null> {
    const idColumn = (this.table as any).id;
    const [row] = await this.db.select().from(this.table).where(eq(idColumn, id)).limit(1);
    return (row as TSelect) ?? null;
  }

  async insertOne(values: TInsert): Promise<TSelect> {
    const [row] = await this.db
      .insert(this.table)
      .values(values as any)
      .returning();
    return row as TSelect;
  }

  async updateById(id: string, values: Partial<TInsert>): Promise<TSelect | null> {
    const idColumn = (this.table as any).id;
    const [row] = await this.db
      .update(this.table)
      .set(values as any)
      .where(eq(idColumn, id))
      .returning();
    return (row as TSelect) ?? null;
  }
}
