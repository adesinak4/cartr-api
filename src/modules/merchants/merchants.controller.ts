import { Body, Controller, Get, Patch, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { MerchantsService } from './merchants.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { ResolveDomainDto } from './dto/resolve-domain.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { Merchant } from '../../db/schema';

@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Roles('owner', 'staff')
  @Get('me')
  async getCurrent() {
    return this.merchantsService.getCurrent();
  }

  @Roles('owner')
  @Patch('me')
  async updateCurrent(@Body() dto: UpdateMerchantDto) {
    return this.merchantsService.updateCurrent(dto);
  }

  @Roles('owner')
  @Post('me/custom-domain/verify')
  async verifyCustomDomain() {
    return this.merchantsService.verifyCustomDomainNow();
  }

  /**
   * Self-serve signup — creates a merchant + owner user and logs them in,
   * returning the same shape as POST /auth/login.
   */
  @Public()
  @Post('public/register')
  async register(@Body() dto: RegisterMerchantDto) {
    return this.merchantsService.register(dto);
  }

  /**
   * Lets a frontend translate a raw Host header (a merchant's custom domain)
   * into the slug it needs to call every other public storefront endpoint —
   * subdomains need no such lookup (the slug IS the subdomain), only custom
   * domains do. Thin wrapper over the same verified-only lookup
   * TenantContextMiddleware already uses internally.
   */
  @Public()
  @Get('public/resolve-domain')
  async resolveDomain(@Query() query: ResolveDomainDto) {
    return this.merchantsService.resolveDomain(query.domain);
  }

  /**
   * Public storefront resolution — TenantContextMiddleware (applied to this
   * route in AppModule) has already resolved the merchant by :slug, checked
   * accountStatus, and seeded TenantContext before this handler runs. Reads
   * the already-resolved merchant off the request rather than looking it up
   * again, so this route doubles as an end-to-end exercise of the middleware.
   */
  @Public()
  @Get('public/storefront/:slug')
  async getPublicStorefront(@Req() req: Request) {
    const merchant = (req as Request & { merchant: Merchant }).merchant;
    return this.merchantsService.getPublicStorefront(merchant);
  }
}
