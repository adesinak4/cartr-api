import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import { NewPlan, Plan, plans } from '../../db/schema';

@Injectable()
export class PlansRepository extends BaseRepository<Plan, NewPlan> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, plans);
  }
}
