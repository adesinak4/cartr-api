import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';

/** Returns the current request's tenant ID, or throws if none is set. */
export const CurrentTenant = createParamDecorator((_data: unknown, _ctx: ExecutionContext) => {
  return TenantContext.requireTenantId();
});
