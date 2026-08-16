import { Injectable, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'node:crypto';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { User } from '../../db/schema';
import { AppRole } from '../../common/decorators/roles.decorator';

export interface AccessTokenPayload {
  sub: string; // user id
  tenantId: string | null;
  role: AppRole;
  jti: string;
  /** Present when decoded by passport-jwt (jsonwebtoken adds this on sign). */
  exp?: number;
}

export interface IssuedTokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

const REVOKED_JTI_PREFIX = 'revoked_jti:';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  signAccessToken(user: Pick<User, 'id' | 'tenantId' | 'role'>): { token: string; jti: string } {
    const jti = crypto.randomUUID();
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      jti,
    };

    const token = this.jwtService.sign(payload, {
      secret: this.config.jwtAccessSecret,
      expiresIn: this.config.jwtAccessExpiry,
    });

    return { token, jti };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwtService.verify<AccessTokenPayload>(token, {
      secret: this.config.jwtAccessSecret,
    });
  }

  /** Opaque, high-entropy — refresh tokens are never parsed client-side, only looked up server-side. */
  generateOpaqueRefreshToken(): string {
    return crypto.randomBytes(48).toString('base64url');
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  refreshTokenExpiry(): Date {
    const days = this.config.jwtRefreshExpiryDays;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  newFamilyId(): string {
    return crypto.randomUUID();
  }

  /** Denylist an access token's jti until its natural expiry — covers the logout window. */
  async denylistAccessToken(jti: string, accessTokenExpiresInSeconds: number): Promise<void> {
    if (accessTokenExpiresInSeconds <= 0) return;
    await this.redis.set(`${REVOKED_JTI_PREFIX}${jti}`, '1', 'EX', accessTokenExpiresInSeconds);
  }

  async isAccessTokenRevoked(jti: string): Promise<boolean> {
    const value = await this.redis.get(`${REVOKED_JTI_PREFIX}${jti}`);
    return value !== null;
  }

  /** Seconds remaining before an access token naturally expires, from its exp claim. */
  secondsUntilExpiry(exp: number): number {
    return exp - Math.floor(Date.now() / 1000);
  }
}
