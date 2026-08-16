import { pgTable, uuid, text, integer, numeric, index } from 'drizzle-orm/pg-core';
import { orders } from './orders.schema';
import { products } from './products.schema';

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // nullable + set null on delete: historical order lines must survive product deletion
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    // snapshotted at purchase time — never live-joined to products, so editing a
    // product later never rewrites past order history
    productNameSnapshot: text('product_name_snapshot').notNull(),
    priceSnapshot: numeric('price_snapshot', { precision: 12, scale: 2 }).notNull(),
    qty: integer('qty').notNull(),
    lineTotal: numeric('line_total', { precision: 12, scale: 2 }).notNull(),
  },
  (table) => ({
    orderIdIdx: index('order_items_order_id_idx').on(table.orderId),
  }),
);

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
