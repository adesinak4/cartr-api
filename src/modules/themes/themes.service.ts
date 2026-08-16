import { Injectable } from '@nestjs/common';
import { ThemesRepository } from './themes.repository';
import { NotFoundError } from '../../common/errors';
import { Theme } from '../../db/schema';

@Injectable()
export class ThemesService {
  constructor(private readonly themesRepository: ThemesRepository) {}

  async list(): Promise<Theme[]> {
    return this.themesRepository.findMany();
  }

  async getById(id: string): Promise<Theme> {
    const theme = await this.themesRepository.findById(id);
    if (!theme) throw new NotFoundError('Theme not found');
    return theme;
  }
}
