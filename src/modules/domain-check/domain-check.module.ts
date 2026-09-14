import { Module } from '@nestjs/common';
import { DomainCheckController } from './domain-check.controller';
import { DomainCheckService } from './domain-check.service';

@Module({
  controllers: [DomainCheckController],
  providers: [DomainCheckService],
})
export class DomainCheckModule {}
