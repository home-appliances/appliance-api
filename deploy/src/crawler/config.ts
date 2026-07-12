/**
 * 爬虫配置
 * 遵循 security-best-practices: API 密钥用环境变量，不硬编码
 * 遵循 native-data-fetching: 环境变量配置
 */

import dotenv from 'dotenv';
import { CrawlerConfig } from './types';

// 加载 .env 文件
dotenv.config();

// =====================================================
// 家电类别配置
// =====================================================
export interface CategoryConfig {
  id: string;           // 类别标识
  name: string;         // 类别中文名
  path: string;         // URL 路径
  brands: string[];     // 品牌列表
}

// 所有家电类别
export const categories: CategoryConfig[] = [
  {
    id: 'icebox',
    name: '冰箱',
    path: 'icebox',
    brands: [
      'haier', 'midea', 'panasonic', 'siemens', 'whirlpool',
      'rongsheng', 'xinfei', 'meiling', 'samsung', 'hisense',
      'lg', 'xiaomi', 'electrolux', 'bocsh', 'toshiba',
      'tcl', 'casarte', 'sharp'
    ]
  },
  {
    id: 'air_condition',
    name: '空调',
    path: 'air_condition',
    brands: [
      'gree', 'midea', 'haier', 'panasonic', 'mitsubishi',
      'daikin', 'hisense', 'mhi', 'kelon', 'aux',
      'samsung', 'chigo', 'xiaomi', 'tcl', 'changhong'
    ]
  },
  {
    id: 'washer',
    name: '洗衣机',
    path: 'washer',
    brands: [
      'ittleswan', 'haier', 'siemens', 'lg', 'panasonic',
      'midea', 'sanyo', 'rsd', 'whirlpool', 'samsung',
      'bosch', 'hisense', 'casarte', 'mi', 'tcl'
    ]
  },
  {
    id: 'gas_water',
    name: '燃气热水器',
    path: 'gas_water',
    brands: [
      'macro', 'haier', 'noritz', 'a/o smith', 'vailant',
      'bosh', 'panasonic', 'midea', 'wanhe', 'uib'
    ]
  },
  {
    id: 'central_water',
    name: '中央热水器',
    path: 'central_water',
    brands: [
      'a/o smith', 'vailant', 'bosh', 'macro', 'haier'
    ]
  },
  {
    id: 'heater',
    name: '取暖器',
    path: 'heater',
    brands: [
      'midea', 'gree', 'dapu', '美的', '格力'
    ]
  },
  {
    id: 'lcd_tv',
    name: '液晶电视',
    path: 'lcd_tv',
    brands: [
      'hisense', 'tcl', 'samsung', 'lg', 'sony',
      'sharp', 'panasonic', 'haier', 'changhong', 'skyworth'
    ]
  },
  {
    id: 'rice_cooker',
    name: '电饭煲',
    path: 'rice_cooker',
    brands: [
      'midea', 'supor', 'zojirushi', ' Panasonic', ' Philips'
    ]
  }
];

// =====================================================
// 配置加载
// =====================================================
export const config: CrawlerConfig = {
  // 数据库配置
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: parseInt(process.env.DB_PORT || '5432'),
  dbName: process.env.DB_NAME || 'appliance_db',
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || '',  // ✅ 不硬编码

  // 爬虫配置
  baseUrl: process.env.CRAWLER_BASE_URL || 'https://product.pconline.com.cn',
  maxConcurrent: parseInt(process.env.CRAWLER_MAX_CONCURRENT || '3'),
  maxRetries: parseInt(process.env.CRAWLER_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.CRAWLER_RETRY_DELAY || '1000'),
  batchSize: parseInt(process.env.CRAWLER_BATCH_SIZE || '50'),

  // 默认品牌列表（兼容旧代码）
  brands: [
    'haier', 'midea', 'panasonic', 'siemens', 'whirlpool',
    'rongsheng', 'xinfei', 'meiling', 'samsung', 'hisense',
    'lg', 'xiaomi', 'electrolux', 'bocsh', 'toshiba',
    'tcl', 'casarte', 'sharp'
  ],
};

// =====================================================
// 获取类别配置
// =====================================================
export function getCategoryConfig(categoryId: string): CategoryConfig | undefined {
  return categories.find(c => c.id === categoryId);
}

// =====================================================
// 获取所有类别 ID
// =====================================================
export function getAllCategoryIds(): string[] {
  return categories.map(c => c.id);
}

// =====================================================
// 配置验证
// =====================================================
export function validateConfig(): void {
  // 验证数据库配置
  if (!config.dbHost) {
    throw new Error('DB_HOST is required');
  }

  if (!config.dbName) {
    throw new Error('DB_NAME is required');
  }

  if (!config.dbUser) {
    throw new Error('DB_USER is required');
  }

  // 验证爬虫配置
  if (config.maxConcurrent < 1 || config.maxConcurrent > 10) {
    throw new Error('CRAWLER_MAX_CONCURRENT must be between 1 and 10');
  }

  if (config.maxRetries < 1 || config.maxRetries > 10) {
    throw new Error('CRAWLER_MAX_RETRIES must be between 1 and 10');
  }

  if (config.retryDelay < 100 || config.retryDelay > 10000) {
    throw new Error('CRAWLER_RETRY_DELAY must be between 100 and 10000');
  }

  if (config.batchSize < 1 || config.batchSize > 100) {
    throw new Error('CRAWLER_BATCH_SIZE must be between 1 and 100');
  }

  // 验证品牌列表
  if (config.brands.length === 0) {
    throw new Error('At least one brand is required');
  }
}

// =====================================================
// 打印配置（不包含敏感信息）
// =====================================================
export function printConfig(): void {
  console.log('📋 爬虫配置:');
  console.log(`  - 数据库: ${config.dbUser}@${config.dbHost}:${config.dbPort}/${config.dbName}`);
  console.log(`  - 基础 URL: ${config.baseUrl}`);
  console.log(`  - 并发数: ${config.maxConcurrent}`);
  console.log(`  - 重试次数: ${config.maxRetries}`);
  console.log(`  - 重试延迟: ${config.retryDelay}ms`);
  console.log(`  - 批量大小: ${config.batchSize}`);
  console.log(`  - 品牌数量: ${config.brands.length}`);
}
