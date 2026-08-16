import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles('owner', 'staff')
  @Get()
  async list() {
    return this.productsService.list();
  }

  @Roles('owner', 'staff')
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.productsService.getById(id);
  }

  @Roles('owner', 'staff')
  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles('owner', 'staff')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles('owner', 'staff')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.productsService.delete(id);
    return null;
  }

  /**
   * Public storefront product browsing — TenantContextMiddleware (applied to
   * these two routes in AppModule) resolves :slug to a tenant before this
   * runs, same as the public merchant/checkout routes.
   */
  @Public()
  @Get('public/storefront/:slug')
  async listPublic() {
    return this.productsService.listPublic();
  }

  @Public()
  @Get('public/storefront/:slug/:productId')
  async getPublicById(@Param('productId') productId: string) {
    return this.productsService.getPublicById(productId);
  }
}
