import { Body, Controller, Delete, Get, Param, Put } from '@nestjs/common';
import { PlatformSettingsRepository } from './platform-settings.repository';
import { UpsertPlatformSettingDto } from './dto/upsert-platform-setting.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from '../../common/audit/audit.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { NotFoundError } from '../../common/errors';

@Controller('admin/settings')
export class PlatformSettingsController {
  constructor(
    private readonly platformSettingsRepository: PlatformSettingsRepository,
    private readonly auditService: AuditService,
  ) {}

  @Roles('admin', 'support')
  @Get()
  async list() {
    return this.platformSettingsRepository.findMany();
  }

  @Roles('admin', 'support')
  @Get(':key')
  async getByKey(@Param('key') key: string) {
    const setting = await this.platformSettingsRepository.findByKey(key);
    if (!setting) throw new NotFoundError('Setting not found');
    return setting;
  }

  @Roles('admin')
  @Put(':key')
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertPlatformSettingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const setting = await this.platformSettingsRepository.upsert(
      key,
      dto.value,
      user.id,
      dto.description,
    );
    await this.auditService.log('platform_setting.updated', 'platform_setting', key, {
      value: dto.value,
    });
    return setting;
  }

  @Roles('admin')
  @Delete(':key')
  async remove(@Param('key') key: string) {
    const deleted = await this.platformSettingsRepository.deleteByKey(key);
    if (!deleted) throw new NotFoundError('Setting not found');
    await this.auditService.log('platform_setting.deleted', 'platform_setting', key);
    return { deleted: true };
  }
}
