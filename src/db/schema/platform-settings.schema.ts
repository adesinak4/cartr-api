import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.schema';

/**
 * Generic key-value store for admin-editable platform config — WhatsApp
 * number, support email, and similar values that shouldn't require a code
 * deploy to change. Deliberately simple (text value, no typed schema) since
 * the set of real settings is small; add validation per-key in the service
 * if/when a setting needs it.
 *
 * Note: existing call sites (e.g. lib/constants.ts's WHATSAPP_LINK on the
 * frontend) are NOT yet wired to read from this table — that's a separate,
 * per-call-site follow-up. This phase only adds the storage + admin CRUD.
 */
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type NewPlatformSetting = typeof platformSettings.$inferInsert;
