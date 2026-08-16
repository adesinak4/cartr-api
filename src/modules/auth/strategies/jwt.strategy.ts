import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../../config/app-config.service';
import { TokenService, AccessTokenPayload } from '../token.service';
import { UnauthorizedError } from '../../../common/errors';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly tokenService: TokenService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const revoked = await this.tokenService.isAccessTokenRevoked(payload.jti);
    if (revoked) {
      throw new UnauthorizedError('Access token has been revoked');
    }

    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      jti: payload.jti,
      // exp is always present on a token that reached this point — passport-jwt
      // rejects tokens with ignoreExpiration:false before validate() is ever called.
      exp: payload.exp!,
    };
  }
}
