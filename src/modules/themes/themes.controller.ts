import { Controller, Get, Param } from '@nestjs/common';
import { ThemesService } from './themes.service';
import { Public } from '../../common/decorators/public.decorator';

/** Themes are public reference data — shown in the merchant's theme picker. */
@Public()
@Controller('themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @Get()
  async list() {
    return this.themesService.list();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.themesService.getById(id);
  }
}
