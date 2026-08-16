import { Injectable } from '@nestjs/common';
import { PlansRepository } from './plans.repository';
import { NotFoundError } from '../../common/errors';
import { Plan } from '../../db/schema';

@Injectable()
export class PlansService {
  constructor(private readonly plansRepository: PlansRepository) {}

  async list(): Promise<Plan[]> {
    return this.plansRepository.findMany();
  }

  async getById(id: string): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) throw new NotFoundError('Plan not found');
    return plan;
  }
}
