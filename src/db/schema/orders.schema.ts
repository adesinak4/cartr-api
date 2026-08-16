import { pgTable, uuid, text, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { orderStatusEnum } from './enums';
import { merchants } from './merchants.schema';
import { customers } from './customers.schema';

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    status: orderStatusEnum('status').notNull().default('pending'),
    subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
    deliveryFee: numeric('delivery_fee', { precision: 12, scale: 2 }).notNull().default('0'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    currency: text('currency').notNull().default('NGN'),
    deliveryStreet: text('delivery_street').notNull(),
    deliveryCity: text('delivery_city').notNull(),
    deliveryState: text('delivery_state').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdIdx: index('orders_tenant_id_idx').on(table.tenantId),
    tenantStatusIdx: index('orders_tenant_status_idx').on(table.tenantId, table.status),
    customerIdIdx: index('orders_customer_id_idx').on(table.customerId),
  }),
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
