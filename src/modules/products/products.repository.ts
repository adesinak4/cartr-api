import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, SQL } from 'drizzle-orm';
import { DRIZZLE_CLIENT, DrizzleDb } from '../../db/db.module';
import { TenantScopedRepository } from '../../common/tenant/tenant-scoped.repository';
import { TenantContext } from '../../common/tenant/tenant-context';
import { NewProduct, Product, ProductImage, productImages, products } from '../../db/schema';

@Injectable()
export class ProductsRepository extends TenantScopedRepository<Product, NewProduct> {
  constructor(@Inject(DRIZZLE_CLIENT) db: DrizzleDb) {
    super(db, products);
  }

  /** Overrides the base class's findMany/findById to exclude soft-deleted rows by default. */
  async findMany(extra?: SQL): Promise<Product[]> {
    const notDeleted = isNull(products.deletedAt);
    return super.findMany(extra ? and(notDeleted, extra) : notDeleted);
  }

  async findById(id: string): Promise<Product | null> {
    const tenantId = TenantContext.requireTenantId();
    const [row] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.tenantId, tenantId), eq(products.id, id), isNull(products.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** Soft delete — sets deletedAt rather than removing the row (order history references products). */
  async softDeleteById(id: string): Promise<boolean> {
    const tenantId = TenantContext.requireTenantId();
    const result = (await this.db
      .update(products)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(products.tenantId, tenantId), eq(products.id, id), isNull(products.deletedAt)),
      )) as unknown as { count: number };
    return result.count > 0;
  }

  /** Public storefront listing — only products the merchant has explicitly published. */
  async findManyActive(): Promise<Product[]> {
    const tenantId = TenantContext.requireTenantId();
    return this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.status, 'active'),
          isNull(products.deletedAt),
        ),
      );
  }

  /** Public storefront detail — draft/archived products 404 here even though they exist. */
  async findActiveById(id: string): Promise<Product | null> {
    const tenantId = TenantContext.requireTenantId();
    const [row] = await this.db
      .select()
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          eq(products.id, id),
          eq(products.status, 'active'),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** Batched — avoids one query per product when building a public listing response. */
  async findImagesByProductIds(productIds: string[]): Promise<ProductImage[]> {
    if (productIds.length === 0) return [];
    return this.db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(asc(productImages.sortOrder));
  }
}
