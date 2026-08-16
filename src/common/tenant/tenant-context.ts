import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenError } from '../errors';

export interface TenantStore {
  // null = platform admin context (no single tenant)
  tenantId: string | null;
  userId: string | null;
  role: 'owner' | 'staff' | 'admin' | null;
}

/**
 * Carries the resolved tenant for the current request through the whole async
 * call chain, so repositories never need tenant info passed to them explicitly.
 * Populated either by an authenticated-request guard (from the JWT payload) or
 * by TenantContextMiddleware (for public storefront requests, resolved from
 * slug/custom domain).
 */
export class TenantContext {
  private static readonly als = new AsyncLocalStorage<TenantStore>();

  static run<T>(store: TenantStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  static get(): TenantStore | undefined {
    return this.als.getStore();
  }

  static requireTenantId(): string {
    const store = this.als.getStore();
    if (!store?.tenantId) {
      throw new ForbiddenError('No tenant context available for this request');
    }
    return store.tenantId;
  }
}
