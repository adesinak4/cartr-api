import { Injectable } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { NotFoundError } from '../../common/errors';
import { Product } from '../../db/schema';

interface PublicProduct {
  id: string;
  name: string;
  description: string | null;
  price: string;
  originalPrice: string | null;
  category: string | null;
  stock: number;
  featured: boolean;
  images: { url: string; sortOrder: number }[];
}

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async list(): Promise<Product[]> {
    return this.productsRepository.findMany();
  }

  async getById(id: string): Promise<Product> {
    const product = await this.productsRepository.findById(id);
    if (!product) throw new NotFoundError('Product not found');
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    return this.productsRepository.insertOne({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      originalPrice: dto.originalPrice,
      category: dto.category,
      stock: dto.stock ?? 0,
      featured: dto.featured ?? false,
      status: 'draft',
    });
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const updated = await this.productsRepository.updateById(id, dto);
    if (!updated) throw new NotFoundError('Product not found');
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.productsRepository.softDeleteById(id);
    if (!deleted) throw new NotFoundError('Product not found');
  }

  async listPublic(): Promise<PublicProduct[]> {
    const activeProducts = await this.productsRepository.findManyActive();
    const images = await this.productsRepository.findImagesByProductIds(
      activeProducts.map((p) => p.id),
    );

    const imagesByProduct = new Map<string, { url: string; sortOrder: number }[]>();
    for (const image of images) {
      const list = imagesByProduct.get(image.productId) ?? [];
      list.push({ url: image.url, sortOrder: image.sortOrder });
      imagesByProduct.set(image.productId, list);
    }

    return activeProducts.map((product) =>
      this.toPublicShape(product, imagesByProduct.get(product.id) ?? []),
    );
  }

  async getPublicById(id: string): Promise<PublicProduct> {
    const product = await this.productsRepository.findActiveById(id);
    if (!product) throw new NotFoundError('Product not found');

    const images = await this.productsRepository.findImagesByProductIds([product.id]);
    return this.toPublicShape(
      product,
      images.map((image) => ({ url: image.url, sortOrder: image.sortOrder })),
    );
  }

  private toPublicShape(
    product: Product,
    images: { url: string; sortOrder: number }[],
  ): PublicProduct {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice,
      category: product.category,
      stock: product.stock,
      featured: product.featured,
      images,
    };
  }
}
