import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { userRoleEnum, userStatusEnum } from './enums';
import { merchants } from './merchants.schema';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // null = platform admin; set = merchant owner/staff
    tenantId: uuid('tenant_id').references(() => merchants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    // Nullable — a Google-only account (see GoogleAuthService) has no
    // password at all. Every login path must handle passwordHash === null
    // (password-based login simply can't succeed for that account).
    passwordHash: text('password_hash'),
    // Google's stable per-account subject id ('sub' claim) — set once a
    // Google identity is linked, whether the account started as Google-only
    // or was auto-linked later against a matching verified email.
    googleId: text('google_id'),
    name: text('name').notNull(),
    // Nullable — existing rows predate this column; required going forward
    // at the DTO level for new signups (see SignupCheckoutDto).
    phone: text('phone'),
    role: userRoleEnum('role').notNull(),
    status: userStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Globally unique by design (see ADR discussion): one login identity per email,
    // no store-picker needed at login.
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    googleIdIdx: uniqueIndex('users_google_id_idx').on(table.googleId),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
