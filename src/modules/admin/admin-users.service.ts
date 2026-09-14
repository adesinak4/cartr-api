import { Injectable } from '@nestjs/common';
import { UsersRepository } from '../users/users.repository';
import { AuthService } from '../auth/auth.service';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { User } from '../../db/schema';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly authService: AuthService,
  ) {}

  async listPlatformUsers(): Promise<User[]> {
    return this.usersRepository.findPlatformUsers();
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return this.usersRepository.findByTenantId(tenantId);
  }

  async createAdminUser(dto: CreateAdminUserDto): Promise<User> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('An account with this email already exists');
    }

    const passwordHash = await AuthService.hashPassword(dto.password);

    return this.usersRepository.create({
      tenantId: null,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      status: 'active',
    });
  }

  async setStatus(id: string, status: 'active' | 'disabled'): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new NotFoundError('User not found');

    if (status === 'disabled' && user.role === 'admin') {
      const platformUsers = await this.usersRepository.findPlatformUsers();
      const otherActiveAdmins = platformUsers.filter(
        (u) => u.id !== id && u.role === 'admin' && u.status === 'active',
      );
      if (otherActiveAdmins.length === 0) {
        throw new ValidationError(
          'Cannot disable the last remaining admin — create another admin first',
        );
      }
    }

    const updated = await this.usersRepository.updateById(id, { status });
    if (!updated) throw new NotFoundError('User not found');
    return updated;
  }
}
