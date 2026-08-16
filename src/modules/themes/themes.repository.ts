import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { BaseRepository } from '../../db/base-repository';
import { NewTheme, Theme, themes } from '../../db/schema';

@Injectable()
export class ThemesRepository extends BaseRepository<Theme, NewTheme> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, themes);
  }
}
