import { Injectable } from '@nestjs/common';
import { TransactionsRepository } from './transactions.repository';
import { NotFoundError } from '../../common/errors';
import { NewTransaction, Transaction } from '../../db/schema';

@Injectable()
export class TransactionsService {
  constructor(private readonly transactionsRepository: TransactionsRepository) {}

  async list(): Promise<Transaction[]> {
    return this.transactionsRepository.findMany();
  }

  async getById(id: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findById(id);
    if (!transaction) throw new NotFoundError('Transaction not found');
    return transaction;
  }

  async create(values: Omit<NewTransaction, 'tenantId'>): Promise<Transaction> {
    return this.transactionsRepository.insertOne(values);
  }

  async findByProviderReference(providerReference: string): Promise<Transaction | null> {
    return this.transactionsRepository.findByProviderReference(providerReference);
  }

  /** Returns whether the order was actually confirmed by this call — see repository docs. */
  async markSuccessAndConfirmOrder(
    transactionId: string,
    orderId: string,
    flutterwaveTransactionId: string,
  ): Promise<boolean> {
    return this.transactionsRepository.markSuccessAndConfirmOrder(
      transactionId,
      orderId,
      flutterwaveTransactionId,
    );
  }

  async markFailed(transactionId: string): Promise<void> {
    await this.transactionsRepository.markFailed(transactionId);
  }

  async findByOrderId(orderId: string): Promise<Transaction | null> {
    return this.transactionsRepository.findByOrderId(orderId);
  }

  /** Returns whether the refund actually recorded by this call — see repository docs. */
  async recordRefund(
    transactionId: string,
    orderId: string,
    refundReference: string,
    refundInitiatedBy: string,
  ): Promise<boolean> {
    return this.transactionsRepository.recordRefund(
      transactionId,
      orderId,
      refundReference,
      refundInitiatedBy,
    );
  }
}
