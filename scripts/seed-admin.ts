import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as schema from '../src/db/schema';

const BCRYPT_COST = 12;

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!email || !password) {
    throw new Error('ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set to seed the first admin');
  }

  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (existing.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Admin user ${email} already exists — skipping.`);
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await db.insert(schema.users).values({
    tenantId: null,
    email,
    passwordHash,
    name: 'Platform Admin',
    role: 'admin',
    status: 'active',
  });

  // eslint-disable-next-line no-console
  console.log(`Admin user ${email} created.`);
  await client.end();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seeding admin failed:', err);
  process.exit(1);
});
