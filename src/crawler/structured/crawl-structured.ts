/**
 * 综合爬虫入口 - 爬取 ZOL + PConline Kitchen
 * 输出：结构化 JSON/CSV + 图片二进制存 DB
 *
 * 使用方法: npm run crawl:structured
 */

import { ZolClient, ZolProduct, ZOL_CATEGORIES } from '../sources/zol-client';
import { PconlineKitchenClient, PconlineKitchenProduct } from '../sources/pconline-kitchen-client';
import { Product, cleanProducts, deduplicateProducts } from './data-cleaner';
import { exportToJson, generateSummary } from './json-exporter';
import { exportToCsv, generateCsvStats } from './csv-exporter';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

// =====================================================
// 配置
// =====================================================

const CONFIG = {
  // ZOL 配置（支持多品类）
  zol: {
    enabled: true,
    // 要爬取的品类
    categories: ['air_condition', 'icebox', 'washer', 'lcd_tv'] as Array<keyof typeof ZOL_CATEGORIES>,
    // 每个品类爬取的页数
    maxPagesPerCategory: 10,
    maxProducts: 0, // 0 = 不限制
  },

  // PConline Kitchen 配置（扩展品类）
  kitchen: {
    enabled: true,
    categories: [
      'dishwasher',      // 洗碗机
      'range_hood',      // 油烟机
      'gas_stove',       // 燃气灶
      'water_heater',    // 热水器
      'icebox',          // 冰箱
      'washer',          // 洗衣机
      'lcd_tv',          // 电视
      'jinghuaqi',       // 净化器
      'jichengzao',      // 集成灶
    ],
    brands: [
      'fotile', 'robam', 'vatti', 'midea', 'haier',
      'vanward', 'macro', 'noritz', 'a_o_smith', 'bosch',
      'siemens', 'panasonic', 'samsung', 'lg', 'sony',
      'hisense', 'tcl', 'xiaomi', 'gree', 'changhong',
    ],
    maxPagesPerCategory: 10,
    maxProducts: 0, // 0 = 不限制
  },

  // 并发控制
  concurrency: 1,  // 降低并发避免被限流
  retryCount: 3,
  retryDelay: 2000,

  // 输出配置
  outputJson: true,
  outputCsv: true,
  saveImagesToDb: true,
};

// =====================================================
// 数据库连接
// =====================================================

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 10,
});

// =====================================================
// 爬虫客户端
// =====================================================

const zolClient = new ZolClient();
const kitchenClient = new PconlineKitchenClient();

// =====================================================
// 限流器
// =====================================================

class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private maxConcurrent: number) {}

  async acquire() {
    if (this.running >= this.maxConcurrent) {
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

const limiter = new RateLimiter(CONFIG.concurrency);

// =====================================================
// ZOL 爬取（支持多品类）
// =====================================================

async function discoverZolProducts(category: string): Promise<Array<{ id: string; category: string; url: string }>> {
  console.log(`\n🔍 ZOL: 发现 ${ZOL_CATEGORIES[category as keyof typeof ZOL_CATEGORIES]?.name || category} 产品...`);

  const allProducts: Array<{ id: string; category: string; url: string }> = [];
  const seenIds = new Set<string>();

  for (let page = 1; page <= CONFIG.zol.maxPagesPerCategory; page++) {
    try {
      const { products } = await zolClient.getProductList(category, page);

      if (products.length === 0) {
        console.log(`   第${page}页无产品，停止翻页`);
        break;
      }

      for (const p of products) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          allProducts.push({
            id: p.id,
            category,
            url: p.url,
          });
        }
      }

      console.log(`   第${page}页: ${products.length} 个产品`);
      await sleep(500);
    } catch (error) {
      console.error(`   第${page}页失败:`, error);
      break;
    }
  }

  console.log(`   ✅ ${ZOL_CATEGORIES[category as keyof typeof ZOL_CATEGORIES]?.name || category} 发现 ${allProducts.length} 个产品`);
  return allProducts;
}

async function crawlZol(): Promise<Product[]> {
  console.log('\n🕷️ 开始爬取 ZOL 家电...');

  const products: Product[] = [];

  try {
    // 遍历所有品类
    for (const category of CONFIG.zol.categories) {
      const categoryName = ZOL_CATEGORIES[category]?.name || category;
      console.log(`\n   📂 品类: ${categoryName}`);

      // 发现产品
      const productList = await discoverZolProducts(category);
      const toCrawl = CONFIG.zol.maxProducts > 0
        ? productList.slice(0, CONFIG.zol.maxProducts)
        : productList;

      console.log(`   待爬取: ${toCrawl.length} 个产品`);

      // 逐个爬取
      for (let i = 0; i < toCrawl.length; i++) {
        const item = toCrawl[i];
        console.log(`   [${i + 1}/${toCrawl.length}] 爬取: ${item.id}`);

        try {
          await limiter.acquire();
          const detail = await zolClient.getProductDetail(item.id, item.category);

          if (detail) {
            products.push(convertZolProduct(detail));
          }
        } catch (error) {
          console.error(`   ❌ 爬取失败: ${item.id}`, error);
        } finally {
          limiter.release();
        }

        await sleep(500);
      }
    }

    console.log(`\n   ✅ ZOL 爬取完成: ${products.length} 个产品`);
  } catch (error) {
    console.error('   ❌ ZOL 爬取异常:', error);
  }

  return products;
}

function convertZolProduct(zol: ZolProduct): Product {
  // 品类名称映射
  const categoryNameMap: Record<string, string> = {
    'air_condition': 'air_condition',
    'icebox': 'icebox',
    'washer': 'washer',
    'lcd_tv': 'lcd_tv',
  };

  return {
    id: `zol_${zol.id}`,
    name: zol.name,
    brand: zol.brand,
    brand_cn: '',
    model: zol.model,
    category: categoryNameMap[zol.category] || zol.category,
    price: null,
    images: zol.images,
    params: zol.params,
    source: {
      platform: 'zol',
      url: zol.source_url,
    },
  };
}

// =====================================================
// PConline Kitchen 爬取
// =====================================================

async function discoverKitchenProducts(): Promise<Array<{ id: string; category: string; url: string }>> {
  console.log('\n🔍 PConline Kitchen: 发现产品...');

  const allProducts: Array<{ id: string; category: string; url: string }> = [];
  const seenIds = new Set<string>();

  for (const category of CONFIG.kitchen.categories) {
    // 无品牌限制
    for (let page = 1; page <= CONFIG.kitchen.maxPagesPerCategory; page++) {
      try {
        const { products } = await kitchenClient.getProductList(category, undefined, page);

        if (products.length === 0) break;

        for (const p of products) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            allProducts.push({ id: p.id, category, url: p.url });
          }
        }

        console.log(`   ${category} 第${page}页: ${products.length} 个产品`);
        await sleep(500);
      } catch (error) {
        console.error(`   ${category} 第${page}页失败:`, error);
        break;
      }
    }

    // 按品牌
    for (const brand of CONFIG.kitchen.brands) {
      for (let page = 1; page <= 3; page++) {
        try {
          const { products } = await kitchenClient.getProductList(category, brand, page);

          if (products.length === 0) break;

          for (const p of products) {
            if (!seenIds.has(p.id)) {
              seenIds.add(p.id);
              allProducts.push({ id: p.id, category, url: p.url });
            }
          }

          await sleep(300);
        } catch (error) {
          break;
        }
      }
    }
  }

  console.log(`   ✅ Kitchen 发现 ${allProducts.length} 个产品`);
  return allProducts;
}

async function crawlKitchen(): Promise<Product[]> {
  console.log('\n🕷️ 开始爬取 PConline 厨卫...');

  const products: Product[] = [];

  try {
    // 发现产品
    const productList = await discoverKitchenProducts();
    const toCrawl = CONFIG.kitchen.maxProducts > 0
      ? productList.slice(0, CONFIG.kitchen.maxProducts)
      : productList;

    console.log(`   待爬取: ${toCrawl.length} 个产品`);

    // 逐个爬取
    for (let i = 0; i < toCrawl.length; i++) {
      const item = toCrawl[i];
      console.log(`   [${i + 1}/${toCrawl.length}] 爬取: ${item.id} (${item.category})`);

      try {
        await limiter.acquire();
        const detail = await kitchenClient.getProductDetail(item.id, item.category);

        if (detail) {
          // 检查是否是有效数据（不是 503 错误）
          if (detail.name && !detail.name.includes('503') && !detail.name.includes('Too many')) {
            products.push(convertKitchenProduct(detail));
          }
        }
      } catch (error) {
        console.error(`   ❌ 爬取失败: ${item.id}`, error);
      } finally {
        limiter.release();
      }

      // 增加请求间隔避免被限流
      await sleep(1000);
    }

    console.log(`   ✅ Kitchen 爬取完成: ${products.length} 个产品`);
  } catch (error) {
    console.error('   ❌ Kitchen 爬取异常:', error);
  }

  return products;
}

function convertKitchenProduct(kitchen: PconlineKitchenProduct): Product {
  return {
    id: `pconline_${kitchen.id}`,
    name: kitchen.name,
    brand: kitchen.brand,
    brand_cn: '',
    model: kitchen.model,
    category: kitchen.category,
    price: kitchen.price,
    images: kitchen.images,
    params: kitchen.params,
    source: {
      platform: 'pconline',
      url: kitchen.source_url,
    },
  };
}

// =====================================================
// 图片下载存 DB（优化版）
// =====================================================

// 下载图片（带重试）
async function downloadImageWithRetry(url: string, maxRetries: number = 3): Promise<Buffer | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(15000),
      });

      // 处理限流
      if (response.status === 429 || response.status === 503) {
        console.log(`   ⚠️ 限流 (${response.status})，等待后重试...`);
        await sleep(2000 * attempt);
        continue;
      }

      if (!response.ok) {
        console.log(`   ⚠️ HTTP ${response.status}: ${url}`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // 验证图片数据有效
      if (buffer.length < 100) {
        console.log(`   ⚠️ 图片数据过小: ${buffer.length} bytes`);
        return null;
      }

      return buffer;
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(`   ⚠️ 下载失败，重试 ${attempt}/${maxRetries}...`);
        await sleep(1000 * attempt);
      } else {
        console.log(`   ❌ 下载失败: ${url}`);
        return null;
      }
    }
  }
  return null;
}

// 获取 MIME 类型
function getMimeType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || 'jpg';
  const mimeMap: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
  };
  return mimeMap[ext] || 'image/jpeg';
}

// 保存单张图片到数据库
async function saveSingleImage(
  client: any,
  imageUrl: string,
  productId: string
): Promise<boolean> {
  // 检查是否已存在
  const existing = await client.query(
    'SELECT id FROM images WHERE source_url = $1',
    [imageUrl]
  );

  if (existing.rows.length > 0) {
    // 已存在，直接返回
    return true;
  }

  // 下载图片
  const buffer = await downloadImageWithRetry(imageUrl);
  if (!buffer) return false;

  // 插入 images 表
  const result = await client.query(
    `INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id`,
    [buffer, getMimeType(imageUrl), buffer.length, imageUrl]
  );

  // 验证插入成功
  if (!result.rows[0]) {
    console.log(`   ❌ 插入失败: ${imageUrl}`);
    return false;
  }

  return true;
}

async function saveImagesToDb(products: Product[]): Promise<number> {
  if (!CONFIG.saveImagesToDb) return 0;

  console.log('\n📸 下载图片并存入数据库...');

  let savedCount = 0;
  let failedCount = 0;
  const client = await pool.connect();

  try {
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (product.images.length === 0) continue;

      console.log(`   [${i + 1}/${products.length}] 处理: ${product.id} (${product.images.length} 张图片)`);

      // 下载所有图片
      let mainImageId: number | null = null;

      for (let j = 0; j < product.images.length; j++) {
        const imageUrl = product.images[j];

        try {
          const success = await saveSingleImage(client, imageUrl, product.id);

          if (success) {
            savedCount++;

            // 获取刚插入的图片 ID（用于关联主图）
            if (j === 0) {
              const imgResult = await client.query(
                'SELECT id FROM images WHERE source_url = $1',
                [imageUrl]
              );
              if (imgResult.rows[0]) {
                mainImageId = imgResult.rows[0].id;
              }
            }
          } else {
            failedCount++;
          }
        } catch (error) {
          console.log(`   ❌ 保存失败: ${imageUrl}`);
          failedCount++;
        }

        // 图片间间隔
        await sleep(300);
      }

      // 关联主图到产品
      if (mainImageId) {
        await client.query(
          'UPDATE products SET image_id = $1 WHERE source_url = $2',
          [mainImageId, product.source.url]
        );
      }

      // 产品间间隔
      await sleep(500);
    }

    console.log(`\n   ✅ 图片保存完成:`);
    console.log(`      成功: ${savedCount} 张`);
    console.log(`      失败: ${failedCount} 张`);
  } catch (error) {
    console.error('   ❌ 图片保存异常:', error);
  } finally {
    client.release();
  }

  return savedCount;
}

// =====================================================
// 工具函数
// =====================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// 主函数
// =====================================================

async function main() {
  console.log('🚀 综合爬虫启动');
  console.log('='.repeat(50));
  console.log(`配置: ZOL=${CONFIG.zol.enabled}, Kitchen=${CONFIG.kitchen.enabled}`);
  console.log(`并发: ${CONFIG.concurrency}, 重试: ${CONFIG.retryCount}`);
  console.log('='.repeat(50));

  const startTime = Date.now();

  try {
    // 1. 并发爬取
    console.log('\n📥 Phase 1: 爬取数据...');

    const [zolProducts, kitchenProducts] = await Promise.all([
      CONFIG.zol.enabled ? crawlZol() : Promise.resolve([]),
      CONFIG.kitchen.enabled ? crawlKitchen() : Promise.resolve([]),
    ]);

    const allProducts = [...zolProducts, ...kitchenProducts];
    console.log(`\n   总计爬取: ${allProducts.length} 个产品`);

    if (allProducts.length === 0) {
      console.log('\n⚠️ 没有爬取到任何产品，退出');
      return;
    }

    // 2. 数据清洗
    console.log('\n🧹 Phase 2: 数据清洗...');
    const cleanedProducts = cleanProducts(allProducts);
    console.log(`   清洗完成: ${cleanedProducts.length} 个产品`);

    // 3. 去重
    console.log('\n🔄 Phase 3: 去重...');
    const deduplicatedProducts = deduplicateProducts(cleanedProducts);
    console.log(`   去重完成: ${deduplicatedProducts.length} 个产品`);

    // 4. 导出
    console.log('\n📤 Phase 4: 导出数据...');

    if (CONFIG.outputJson) {
      await exportToJson(deduplicatedProducts);
    }

    if (CONFIG.outputCsv) {
      await exportToCsv(deduplicatedProducts);
    }

    // 5. 图片存 DB
    if (CONFIG.saveImagesToDb) {
      await saveImagesToDb(deduplicatedProducts);
    }

    // 6. 输出统计
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log('\n' + '='.repeat(50));
    console.log('📊 爬取完成');
    console.log('='.repeat(50));
    console.log(`   耗时: ${Math.floor(duration / 60)}分${duration % 60}秒`);
    console.log(`   总产品: ${deduplicatedProducts.length}`);

    // 输出摘要
    const summary = generateSummary(deduplicatedProducts);
    console.log(summary);

    const csvStats = generateCsvStats(deduplicatedProducts);
    console.log(`   有价格: ${csvStats.withPrice} (${(csvStats.withPrice / csvStats.total * 100).toFixed(1)}%)`);
    console.log(`   有图片: ${csvStats.withImages} (${(csvStats.withImages / csvStats.total * 100).toFixed(1)}%)`);
    console.log(`   有参数: ${csvStats.withParams} (${(csvStats.withParams / csvStats.total * 100).toFixed(1)}%)`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ 爬虫异常:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
