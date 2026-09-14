import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { User } from '../../db/schema';

// Whitelisted — never return passwordHash to any client, admin included.
function toSafeUser(user: User) {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly auditService: AuditService,
  ) {}

  @Roles('admin', 'support')
  @Get()
  async list(@Query('tenantId') tenantId?: string) {
    const users = tenantId
      ? await this.adminUsersService.listByTenant(tenantId)
      : await this.adminUsersService.listPlatformUsers();
    return users.map(toSafeUser);
  }

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateAdminUserDto) {
    const user = await this.adminUsersService.createAdminUser(dto);
    await this.auditService.log('user.created', 'user', user.id, { role: user.role });
    return toSafeUser(user);
  }

  @Roles('admin')
  @Patch(':id/status')
  async setStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    const user = await this.adminUsersService.setStatus(id, dto.status);
    await this.auditService.log('user.status_changed', 'user', user.id, { status: user.status });
    return toSafeUser(user);
  }
}
