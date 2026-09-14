import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { domainProvisioningStatusEnum } from './enums';
import { merchants } from './merchants.schema';

/**
 * One row per merchant whose domain still needs Truehost registration + DNS
 * pointing — ops-driven and manual for now (see the domain-architecture
 * discussion). This table is just the queue; the admin UI to work it is a
 * later phase. Written by OnboardingService the moment a signup payment
 * confirms, so the record exists even before any admin tooling reads it.
 */
export const domainProvisioningTasks = pgTable('domain_provisioning_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: uuid('merchant_id')
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  desiredDomain: text('desired_domain').notNull(),
  status: domainProvisioningStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  doneAt: timestamp('done_at', { withTimezone: true }),
});

export type DomainProvisioningTask = typeof domainProvisioningTasks.$inferSelect;
export type NewDomainProvisioningTask = typeof domainProvisioningTasks.$inferInsert;
