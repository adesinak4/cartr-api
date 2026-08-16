import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import postgres, { Sql } from 'postgres';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppConfigService } from '../config/app-config.service';
import * as schema from './schema';

export const DRIZZLE_CLIENT = Symbol('DRIZZLE_CLIENT');
export const POSTGRES_CONNECTION = Symbol('POSTGRES_CONNECTION');

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CONNECTION,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): Sql => postgres(config.databaseUrl, { max: 10 }),
    },
    {
      provide: DRIZZLE_CLIENT,
      inject: [POSTGRES_CONNECTION],
      useFactory: (client: Sql): DrizzleDb => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE_CLIENT],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_CONNECTION) private readonly client: Sql) {}

  async onApplicationShutdown() {
    await this.client.end();
  }
}
