import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersRepository } from '../users/users.repository';
import { RefreshTokenRepository } from './refresh-token.repository';
import { TokenService } from './token.service';
import { UnauthorizedError } from '../../common/errors';
import { User } from '../../db/schema';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, 'id' | 'tenantId' | 'role' | 'name' | 'email'>;
}

const BCRYPT_COST = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly tokenService: TokenService,
  ) {}

  /** Used by LocalStrategy — verifies credentials, returns the user or null. */
  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user || user.status !== 'active') return null;

    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) return null;

    return user;
  }

  async login(user: User): Promise<LoginResult> {
    const { token: accessToken } = this.tokenService.signAccessToken(user);
    const { refreshToken } = await this.issueRefreshToken(user.id, this.tokenService.newFamilyId());

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
        email: user.email,
      },
    };
  }

  async refresh(presentedToken: string): Promise<Omit<LoginResult, 'user'>> {
    const tokenHash = this.tokenService.hashToken(presentedToken);
    const existing = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (!existing) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token has expired');
    }

    if (existing.revokedAt) {
      // A revoked token being presented again means it was already rotated once
      // (or explicitly logged out) and is now being reused — treat as theft and
      // kill the whole family so a stolen token chain can't keep refreshing.
      this.logger.warn(`Revoked refresh token reuse detected for family ${existing.familyId}`);
      await this.refreshTokenRepository.revokeFamily(existing.familyId);
      throw new UnauthorizedError('Refresh token has been revoked');
    }

    const user = await this.usersRepository.findById(existing.userId);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedError('User is no longer active');
    }

    // Rotation: revoke the presented token, issue a new one in the same family.
    await this.refreshTokenRepository.revokeById(existing.id);
    const { token: accessToken } = this.tokenService.signAccessToken(user);
    const { refreshToken } = await this.issueRefreshToken(user.id, existing.familyId);

    return { accessToken, refreshToken };
  }

  async logout(presentedToken: string, accessTokenJti?: string, accessTokenExp?: number) {
    const tokenHash = this.tokenService.hashToken(presentedToken);
    const existing = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    if (existing && !existing.revokedAt) {
      await this.refreshTokenRepository.revokeById(existing.id);
    }

    if (accessTokenJti && accessTokenExp) {
      const ttl = this.tokenService.secondsUntilExpiry(accessTokenExp);
      await this.tokenService.denylistAccessToken(accessTokenJti, ttl);
    }
  }

  private async issueRefreshToken(userId: string, familyId: string) {
    const refreshToken = this.tokenService.generateOpaqueRefreshToken();
    await this.refreshTokenRepository.create({
      userId,
      familyId,
      tokenHash: this.tokenService.hashToken(refreshToken),
      expiresAt: this.tokenService.refreshTokenExpiry(),
    });
    return { refreshToken };
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_COST);
  }
}
