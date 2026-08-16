import { pgTable, uuid, text, integer, index } from 'drizzle-orm/pg-core';
import { products } from './products.schema';

export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => ({
    productIdIdx: index('product_images_product_id_idx').on(table.productId),
  }),
);

export type ProductImage = typeof productImages.$inferSelect;
export type NewProductImage = typeof productImages.$inferInsert;
