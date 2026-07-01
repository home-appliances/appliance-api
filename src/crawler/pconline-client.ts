/**
 * PConline API 客户端
 * 遵循 native-data-fetching: 使用 fetch、错误处理、限流
 * 遵循 security-best-practices: 输入验证、错误处理
 */

import { config } from './config';
import { ProductList } from './types';
import {
  parseProductList,
  parseProductParams,
  parseProductName,
  parseProductImages,
  parseProductPrice,
  parseProductRating,
} from './html-parser';
import {
  isValidBrand,
  isValidProductId,
  sleep,
} from './utils';
import {
  logRequest,
  logRequestSuccess,
  logRequestFailed,
} from './logger';

// =====================================================
// 限流器
// =====================================================
class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private maxPerSecond: number) {}

  async acquire() {
    if (this.running >= this.maxPerSecond) {
      await new Promise(resolve => this.queue.push(resolve));
    }
    this.running++;
  }

  release() {
    this.running--;
    if (this.queue.length > 0) {
      this.queue.shift()!();
    }
  }
}

// =====================================================
// 错误类
// =====================================================
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// =====================================================
// PConline 客户端
// =====================================================
export class PconlineClient {
  private limiter: RateLimiter;

  constructor() {
    this.limiter = new RateLimiter(config.maxConcurrent);
  }

  // =====================================================
  // 核心请求方法（带重试）
  // =====================================================
  async fetchWithRetry(url: string): Promise<string> {
    for (let i = 0; i < config.maxRetries; i++) {
      await this.limiter.acquire();
      const startTime = Date.now();

      try {
        logRequest(url);

        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          signal: AbortSignal.timeout(30000), // 30 秒超时
        });

        const duration = Date.now() - startTime;

        if (!response.ok) {
          throw new ApiError(`HTTP ${response.status}`, response.status);
        }

        const buffer = await response.arrayBuffer();
        const html = this.decodeGBK(buffer);
        logRequestSuccess(url, duration);

        return html;
      } catch (error) {
        const duration = Date.now() - startTime;

        if (i === config.maxRetries - 1) {
          logRequestFailed(url, error as Error, i + 1);
          throw error;
        }

        // 指数退避
        const delay = Math.pow(2, i) * config.retryDelay;
        await sleep(delay);
      } finally {
        this.limiter.release();
      }
    }

    throw new ApiError('Max retries exceeded', 0, 'MAX_RETRIES');
  }

  // =====================================================
  // 解码 GBK 编码
  // =====================================================
  private decodeGBK(buffer: ArrayBuffer): string {
    // 尝试使用 TextDecoder 解码 GBK
    try {
      const decoder = new TextDecoder('gbk');
      return decoder.decode(buffer);
    } catch {
      // 如果 GBK 不可用，使用 UTF-8
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(buffer);
    }
  }

  // =====================================================
  // 验证品牌名称
  // =====================================================
  private validateBrand(brand: string): void {
    if (!isValidBrand(brand)) {
      throw new Error(`无效的品牌名称: ${brand}`);
    }
  }

  // =====================================================
  // 验证产品 ID
  // =====================================================
  private validateProductId(productId: string): void {
    if (!isValidProductId(productId)) {
      throw new Error(`无效的产品 ID: ${productId}`);
    }
  }

  // =====================================================
  // 获取产品列表
  // =====================================================
  async getProductList(brand: string, cursor?: string, category: string = 'icebox'): Promise<ProductList> {
    this.validateBrand(brand);

    let url: string;
    if (cursor) {
      // cursor 可能是相对路径 "/icebox/haier/list_25s1.shtml"
      // 或绝对路径 "//product.pconline.com.cn/icebox/haier/list_25s1.shtml"
      if (cursor.startsWith('//')) {
        url = `https:${cursor}`;
      } else if (cursor.startsWith('/')) {
        url = `https://product.pconline.com.cn${cursor}`;
      } else {
        url = cursor;
      }
    } else {
      url = `${config.baseUrl}/${category}/${brand}/list.shtml`;
    }

    const html = await this.fetchWithRetry(url);
    return parseProductList(html, brand, category);
  }

  // =====================================================
  // 获取产品参数
  // =====================================================
  async getProductParams(
    brand: string,
    productId: string,
    category: string = 'icebox'
  ): Promise<Record<string, any>> {
    this.validateBrand(brand);
    this.validateProductId(productId);

    const url = `${config.baseUrl}/${category}/${brand}/${productId}_detail.html`;
    const html = await this.fetchWithRetry(url);
    return parseProductParams(html);
  }

  // =====================================================
  // 获取产品详情（名称、图片、价格、评分）
  // =====================================================
  async getProductDetail(
    brand: string,
    productId: string,
    category: string = 'icebox'
  ): Promise<{
    name: string | null;
    images: string[];
    price: number | null;
    rating: number | null;
  }> {
    this.validateBrand(brand);
    this.validateProductId(productId);

    const url = `${config.baseUrl}/${category}/${brand}/${productId}.html`;
    const html = await this.fetchWithRetry(url);

    return {
      name: parseProductName(html),
      images: parseProductImages(html),
      price: parseProductPrice(html),
      rating: parseProductRating(html),
    };
  }

  // =====================================================
  // 获取所有品牌的产品 ID
  // =====================================================
  async getAllProductIds(brand: string): Promise<string[]> {
    this.validateBrand(brand);

    const allIds: string[] = [];
    let cursor: string | undefined;

    do {
      const list = await this.getProductList(brand, cursor);
      allIds.push(...list.products.map(p => p.id));
      cursor = list.nextCursor;
    } while (cursor);

    return allIds;
  }

  // =====================================================
  // 检查产品是否存在
  // =====================================================
  async checkProductExists(
    brand: string,
    productId: string
  ): Promise<boolean> {
    try {
      this.validateBrand(brand);
      this.validateProductId(productId);

      const url = `${config.baseUrl}/icebox/${brand}/${productId}.html`;
      await this.fetchWithRetry(url);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }
}
