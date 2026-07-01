/**
 * 爬虫类型定义
 * 遵循 TypeScript 最佳实践
 */

// =====================================================
// 产品类型
// =====================================================
export interface Product {
  name: string;
  brand: string;
  category?: string;      // 产品类别（icebox, air_condition, washer 等）
  model?: string;
  params: Record<string, any>;
  price?: number;
  rating?: number;
  images?: string[];
  imageUrl?: string;
  sourceUrl: string;
  sourcePlatform?: string;
}

// =====================================================
// 产品列表
// =====================================================
export interface ProductList {
  products: Array<{
    id: string;
    name: string;
    url: string;
  }>;
  nextCursor?: string;
}

// =====================================================
// 图片类型
// =====================================================
export interface ImageData {
  data: Buffer;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  sourceUrl: string;
}

// =====================================================
// 爬虫配置
// =====================================================
export interface CrawlerConfig {
  // 数据库配置
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;

  // 爬虫配置
  baseUrl: string;
  maxConcurrent: number;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;

  // 品牌列表
  brands: string[];
}

// =====================================================
// 爬虫状态
// =====================================================
export interface CrawlerState {
  crawledIds: Set<string>;
  failedProducts: FailedProduct[];
  startTime: Date;
  totalProducts: number;
  successCount: number;
  failCount: number;
}

// =====================================================
// 失败产品
// =====================================================
export interface FailedProduct {
  brand: string;
  productId: string;
  category?: string;      // 产品类别
  error: string;
  retries: number;
  lastAttempt: Date;
}

// =====================================================
// 进度报告
// =====================================================
export interface ProgressReport {
  total: number;
  current: number;
  percentage: number;
  rate: number;
  remaining: number;
  elapsed: number;
}
