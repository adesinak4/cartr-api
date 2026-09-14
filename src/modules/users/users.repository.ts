import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import { NewUser, User, users } from '../../db/schema';

/**
 * Not tenant-scoped: the primary lookup (by email, for login) happens before
 * a tenant is known at all, since email is globally unique across the platform.
 * Extends BaseRepository for id-based CRUD, adds email lookup on top.
 */
@Injectable()
export class UsersRepository extends BaseRepository<User, NewUser> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, users);
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return row ?? null;
  }

  /** The store owner's own login — used where a contact email is needed (e.g. subscription billing). */
  async findOwnerByTenantId(tenantId: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')))
      .limit(1);
    return row ?? null;
  }

  async create(values: NewUser): Promise<User> {
    return this.insertOne(values);
  }

  /** Platform-level users (admin/support) — tenantId null by convention. */
  async findPlatformUsers(): Promise<User[]> {
    return this.db.select().from(users).where(isNull(users.tenantId));
  }

  /** A given merchant's owner + staff accounts — for admin's merchant-detail user list. */
  async findByTenantId(tenantId: string): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.tenantId, tenantId));
  }
}
