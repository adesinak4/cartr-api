import { Injectable } from '@nestjs/common';
import { DisputesRepository, DisputeListFilter, DisputeRow } from './disputes.repository';
import { OrdersRepository } from '../orders/orders.repository';
import { ForbiddenError, NotFoundError, ValidationError } from '../../common/errors';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { Dispute } from '../../db/schema';
import { TenantContext } from '../../common/tenant/tenant-context';

@Injectable()
export class DisputesService {
  constructor(
    private readonly disputesRepository: DisputesRepository,
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async list(filter: DisputeListFilter): Promise<DisputeRow[]> {
    return this.disputesRepository.listWithMerchant(filter);
  }

  async getById(id: string): Promise<Dispute> {
    const dispute = await this.disputesRepository.findById(id);
    if (!dispute) throw new NotFoundError('Dispute not found');
    return dispute;
  }

  async create(dto: CreateDisputeDto): Promise<Dispute> {
    const order = await this.ordersRepository.findByIdUnscoped(dto.orderId);
    if (!order) throw new NotFoundError('Order not found');

    const actorId = TenantContext.get()?.userId;
    if (!actorId) throw new ForbiddenError('No authenticated admin context available');

    return this.disputesRepository.insertOne({
      orderId: order.id,
      tenantId: order.tenantId,
      reason: dto.reason,
      createdBy: actorId,
    });
  }

  async resolve(id: string, resolutionNotes: string): Promise<Dispute> {
    const dispute = await this.disputesRepository.findById(id);
    if (!dispute) throw new NotFoundError('Dispute not found');
    if (dispute.status === 'resolved') {
      throw new ValidationError('This dispute is already resolved');
    }

    const actor = TenantContext.get();
    const updated = await this.disputesRepository.updateById(id, {
      status: 'resolved',
      resolutionNotes,
      resolvedBy: actor?.userId ?? undefined,
      resolvedAt: new Date(),
    });
    if (!updated) throw new NotFoundError('Dispute not found');
    return updated;
  }
}
