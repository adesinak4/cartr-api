import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import { NewSignupDraft, SignupDraft, signupDrafts } from '../../db/schema';

@Injectable()
export class SignupDraftsRepository extends BaseRepository<SignupDraft, NewSignupDraft> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, signupDrafts);
  }

  async markCompleted(id: string, merchantId: string): Promise<SignupDraft | null> {
    const [row] = await this.db
      .update(signupDrafts)
      .set({ status: 'completed', merchantId })
      .where(eq(signupDrafts.id, id))
      .returning();
    return row ?? null;
  }

  async markFailed(id: string): Promise<void> {
    await this.db.update(signupDrafts).set({ status: 'failed' }).where(eq(signupDrafts.id, id));
  }

  /**
   * Atomically claims the one-time login token — the WHERE clause requires
   * loginTokenConsumedAt still be NULL, so under a concurrent double-call
   * only one UPDATE ever matches a row; the other gets zero rows back and
   * this returns null. A plain "update then check" would have a race window
   * a second, simultaneous call could slip through.
   */
  async consumeLoginToken(id: string): Promise<SignupDraft | null> {
    const [row] = await this.db
      .update(signupDrafts)
      .set({ loginTokenConsumedAt: new Date() })
      .where(and(eq(signupDrafts.id, id), isNull(signupDrafts.loginTokenConsumedAt)))
      .returning();
    return row ?? null;
  }
}
