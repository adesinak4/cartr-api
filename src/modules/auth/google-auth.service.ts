import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AppConfigService } from '../../config/app-config.service';
import { ServiceUnavailableError, UnauthorizedError } from '../../common/errors';

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Verifies a Google ID token sent from the frontend's "Continue with
 * Google" button (Google Identity Services, client-side) — never trusts
 * the token's claims without cryptographic verification against Google's
 * own public keys, which this library handles.
 */
@Injectable()
export class GoogleAuthService {
  private readonly client: OAuth2Client | null;

  constructor(private readonly config: AppConfigService) {
    this.client = config.googleClientId ? new OAuth2Client(config.googleClientId) : null;
  }

  async verifyIdToken(idToken: string): Promise<GoogleProfile> {
    if (!this.client) {
      throw new ServiceUnavailableError('Google sign-in is not configured');
    }

    let payload;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedError('Invalid Google sign-in token');
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedError('Invalid Google sign-in token');
    }

    // Google's own guarantee that the email is verified — required before
    // we ever trust it for auto-linking against an existing password account.
    if (!payload.email_verified) {
      throw new UnauthorizedError('Google account email is not verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      firstName: payload.given_name ?? '',
      lastName: payload.family_name ?? '',
    };
  }
}
