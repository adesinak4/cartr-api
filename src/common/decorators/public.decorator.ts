import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Bypasses JwtAuthGuard for this route/controller. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
