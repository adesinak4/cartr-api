import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from './tenant-context';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

/**
 * Runs after JwtAuthGuard has attached `req.user`. Seeds TenantContext for the
 * remainder of the request lifecycle from the authenticated user's JWT claims.
 * Public/unauthenticated routes have no req.user — TenantContextMiddleware
 * handles tenant resolution for those (public storefront requests) instead.
 *
 * IMPORTANT: next.handle() returns a lazy Observable — calling it does not run
 * the controller. The actual work only happens on subscribe(), so the
 * subscription itself (not just the .handle() call) must happen inside the
 * AsyncLocalStorage.run() callback, otherwise the context never attaches to
 * the async chain the controller/services run in.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      return next.handle();
    }

    const store = { tenantId: user.tenantId, userId: user.id, role: user.role };

    return new Observable((subscriber) => {
      TenantContext.run(store, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
