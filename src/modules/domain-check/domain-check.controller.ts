import { Controller, Get, Query } from '@nestjs/common';
import { DomainCheckService } from './domain-check.service';
import { CheckDomainDto } from './dto/check-domain.dto';
import { SuggestDomainDto } from './dto/suggest-domain.dto';
import { Public } from '../../common/decorators/public.decorator';

/** Public/unauthenticated — used during the onboarding wizard, before an account exists. */
@Public()
@Controller('domains/public')
export class DomainCheckController {
  constructor(private readonly domainCheckService: DomainCheckService) {}

  /** Re-checks one specific candidate — used when the merchant edits the domain field themselves. */
  @Get('check')
  async check(@Query() query: CheckDomainDto) {
    return this.domainCheckService.check(`${query.domain}.com.ng`);
  }

  /** Business-name-derived primary candidate + alternates if it's taken. */
  @Get('suggest')
  async suggest(@Query() query: SuggestDomainDto) {
    return this.domainCheckService.suggest(query.businessName);
  }
}
