import { Injectable } from '@nestjs/common';
import { CustomersRepository } from './customers.repository';
import { NotFoundError } from '../../common/errors';
import { Customer } from '../../db/schema';
import { CreateCustomerDto } from './dto/create-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly customersRepository: CustomersRepository) {}

  async list(): Promise<Customer[]> {
    return this.customersRepository.findMany();
  }

  async getById(id: string): Promise<Customer> {
    const customer = await this.customersRepository.findById(id);
    if (!customer) throw new NotFoundError('Customer not found');
    return customer;
  }

  /** Used by checkout — upserts on phone, never fails on repeat customers. */
  async findOrCreate(dto: CreateCustomerDto): Promise<Customer> {
    return this.customersRepository.findOrCreate(dto);
  }
}
