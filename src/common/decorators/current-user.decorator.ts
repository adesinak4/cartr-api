import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppRole } from './roles.decorator';

export interface AuthenticatedUser {
  id: string;
  tenantId: string | null;
  role: AppRole;
  jti: string;
  /** Access token's `exp` claim (seconds since epoch) — needed to size the logout denylist TTL. */
  exp: number;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
