import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MerchantsRepository } from '../merchants/merchants.repository';
import { NotFoundError } from '../../common/errors';
import { Merchant } from '../../db/schema';
import { DomainEvents } from '../../common/events/domain-events';

@Injectable()
export class AdminService {
  constructor(
    private readonly merchantsRepository: MerchantsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listMerchants(): Promise<Merchant[]> {
    return this.merchantsRepository.findMany();
  }

  async getMerchant(id: string): Promise<Merchant> {
    const merchant = await this.merchantsRepository.findById(id);
    if (!merchant) throw new NotFoundError('Merchant not found');
    return merchant;
  }

  async suspend(id: string): Promise<Merchant> {
    const updated = await this.merchantsRepository.updateById(id, { accountStatus: 'suspended' });
    if (!updated) throw new NotFoundError('Merchant not found');

    this.eventEmitter.emit(DomainEvents.MERCHANT_SUSPENDED, {
      merchantId: updated.id,
      slug: updated.slug,
    });

    return updated;
  }

  async reactivate(id: string): Promise<Merchant> {
    const updated = await this.merchantsRepository.updateById(id, { accountStatus: 'active' });
    if (!updated) throw new NotFoundError('Merchant not found');

    this.eventEmitter.emit(DomainEvents.MERCHANT_REACTIVATED, {
      merchantId: updated.id,
      slug: updated.slug,
    });

    return updated;
  }
}
