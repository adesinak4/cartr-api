import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { PlatformSetting, platformSettings } from '../../db/schema';

@Injectable()
export class PlatformSettingsRepository {
  constructor(@Inject(DRIZZLE_CLIENT) private readonly db: DrizzleDb) {}

  async findMany(): Promise<PlatformSetting[]> {
    return this.db.select().from(platformSettings);
  }

  async findByKey(key: string): Promise<PlatformSetting | null> {
    const [row] = await this.db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .limit(1);
    return row ?? null;
  }

  async upsert(
    key: string,
    value: string,
    updatedBy: string,
    description?: string,
  ): Promise<PlatformSetting> {
    const [row] = await this.db
      .insert(platformSettings)
      .values({ key, value, description, updatedBy, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, description, updatedBy, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async deleteByKey(key: string): Promise<boolean> {
    const result = await this.db.delete(platformSettings).where(eq(platformSettings.key, key));
    return (result as unknown as { count: number }).count > 0;
  }
}
