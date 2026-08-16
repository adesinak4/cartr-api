import { Module } from '@nestjs/common';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';
import { ThemesRepository } from './themes.repository';

@Module({
  controllers: [ThemesController],
  providers: [ThemesService, ThemesRepository],
  exports: [ThemesService, ThemesRepository],
})
export class ThemesModule {}
