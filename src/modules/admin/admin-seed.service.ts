import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from '../auth/auth.service';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Auto-seeds the first platform admin on boot, from ADMIN_SEED_EMAIL/
 * ADMIN_SEED_PASSWORD — idempotent (skips if that email already exists), and
 * never fails app startup if seeding itself fails (e.g. migrations haven't
 * run yet on a brand new deploy) — logs and moves on, since a missing admin
 * is recoverable later but a crashed boot blocks everything including the
 * health check that would tell anyone something's wrong.
 */
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly config: AppConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.adminSeedEmail;
    const password = this.config.adminSeedPassword;

    if (!email || !password) {
      this.logger.log(
        'ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD not set — skipping automatic admin seed',
      );
      return;
    }

    try {
      const existing = await this.usersRepository.findByEmail(email);
      if (existing) {
        this.logger.log(`Admin user ${email} already exists — skipping seed`);
        return;
      }

      const passwordHash = await AuthService.hashPassword(password);
      await this.usersRepository.create({
        tenantId: null,
        email,
        passwordHash,
        name: 'Platform Admin',
        role: 'admin',
        status: 'active',
      });

      this.logger.log(`Seeded platform admin user: ${email}`);
    } catch (err) {
      this.logger.error(
        `Automatic admin seed failed — an admin account may need to be created manually: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
