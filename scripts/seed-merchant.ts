import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as schema from '../src/db/schema';

const BCRYPT_COST = 12;

/**
 * Dev-only convenience — there is no merchant signup flow in this API yet
 * (a known, documented gap), so this is currently the only way to get a
 * real merchant + owner login for local frontend development.
 */
async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.MERCHANT_SEED_EMAIL;
  const password = process.env.MERCHANT_SEED_PASSWORD;
  const slug = process.env.MERCHANT_SEED_SLUG ?? 'dev-store';
  const storeName = process.env.MERCHANT_SEED_STORE_NAME ?? 'Dev Store';

  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!email || !password) {
    throw new Error(
      'MERCHANT_SEED_EMAIL and MERCHANT_SEED_PASSWORD must be set to seed a dev merchant',
    );
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
    console.log(`Merchant owner ${email} already exists — skipping.`);
    await client.end();
    return;
  }

  const [merchant] = await db
    .insert(schema.merchants)
    .values({
      slug,
      storeName,
      accountStatus: 'active',
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      nextRenewalAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  await db.insert(schema.users).values({
    tenantId: merchant.id,
    email,
    passwordHash,
    name: 'Dev Owner',
    role: 'owner',
    status: 'active',
  });

  // eslint-disable-next-line no-console
  console.log(`Merchant "${storeName}" (slug: ${slug}) and owner ${email} created.`);
  await client.end();
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seeding merchant failed:', err);
  process.exit(1);
});
