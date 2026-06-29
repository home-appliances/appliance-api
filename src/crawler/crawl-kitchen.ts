/**
 * PConline 厨卫爬虫入口
 * 使用方法: npm run crawl:kitchen
 */

import { PconlineKitchenClient } from './sources/pconline-kitchen-client';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

const kitchenClient = new PconlineKitchenClient();

// 分类配置
const CATEGORIES = [
  { id: 'dishwasher', name: '洗碗机', brand: undefined },
  { id: 'range_hood', name: '油烟机', brand: undefined },
  { id: 'gas_stove', name: '燃气灶', brand: undefined },
  { id: 'water_heater', name: '热水器', brand: undefined },
];

// 需要爬取的品牌
const BRANDS = [
  'fotile', 'robam', 'vatti', 'midea', 'haier',
  'vanward', 'macro', 'noritz', 'a_o_smith', 'bosch',
];

// 配置
const CONFIG = {
  concurrency: 3,
  maxRetries: 3,
  maxProductsPerCategory: 50,
};

/**
 * 保存产品到数据库
 */
async function saveProduct(product: any): Promise<boolean> {
  try {
    // 检查是否已存在
    const existing = await pool.query(
      'SELECT id FROM products WHERE source_url = $1 OR (brand = $2 AND model = $3 AND model != \'\')',
      [product.source_url, product.brand, product.model]
    );

    if (existing.rows.length > 0) {
      console.log(`   ⏭️ 产品已存在，跳过: ${product.name}`);
      return false;
    }

    // 插入新记录
    const result = await pool.query(
      `INSERT INTO products (
        name, brand, model, params, price, images,
        source_url, source_platform, category,
        last_crawled_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING id`,
      [
        product.name,
        product.brand,
        product.model,
        product.params || {},
        product.price,
        product.images || [],
        product.source_url,
        product.source_platform,
        product.category,
      ]
    );

    console.log(`   ✅ 保存成功: ${product.name} (ID: ${result.rows[0].id})`);
    return true;
  } catch (error) {
    console.error(`   ❌ 保存失败: ${product.name}`, error);
    return false;
  }
}

/**
 * 爬取单个分类
 */
async function crawlCategory(categoryId: string, categoryName: string, brand?: string) {
  console.log(`\n📂 爬取分类: ${categoryName}${brand ? ` (${brand})` : ''}`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    // 获取产品列表
    const { products, total } = await kitchenClient.getProductList(categoryId, brand);
    console.log(`   找到 ${total} 个产品`);

    // 限制数量
    const toCrawl = products.slice(0, CONFIG.maxProductsPerCategory);

    // 逐个爬取
    for (const item of toCrawl) {
      console.log(`   📥 爬取: ${item.name || item.id}`);

      let retries = 0;
      let success = false;

      while (retries < CONFIG.maxRetries && !success) {
        try {
          const product = await kitchenClient.getProductDetail(item.id, categoryId);
          if (product) {
            const saved = await saveProduct(product);
            if (saved) {
              successCount++;
            } else {
              skipCount++;
            }
            success = true;
          } else {
            console.log(`   ⚠️ 产品不存在: ${item.id}`);
            skipCount++;
            success = true;
          }
        } catch (error) {
          retries++;
          if (retries < CONFIG.maxRetries) {
            console.log(`   ⚠️ 重试 ${retries}/${CONFIG.maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          } else {
            console.error(`   ❌ 爬取失败: ${item.id}`, error);
            failCount++;
          }
        }
      }

      // 限流
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`   📊 ${categoryName} 爬取完成: 成功=${successCount}, 跳过=${skipCount}, 失败=${failCount}`);

    return { successCount, failCount, skipCount };
  } catch (error) {
    console.error(`   ❌ 分类爬取异常: ${categoryName}`, error);
    return { successCount: 0, failCount: 1, skipCount: 0 };
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🕷️ PConline 厨卫爬虫启动\n');
  console.log(`配置: 并发=${CONFIG.concurrency}, 重试=${CONFIG.maxRetries}\n`);

  let totalSuccess = 0;
  let totalFail = 0;
  let totalSkip = 0;

  try {
    // 爬取每个分类
    for (const category of CATEGORIES) {
      // 先爬取无品牌限制的产品
      const result = await crawlCategory(category.id, category.name);
      totalSuccess += result.successCount;
      totalFail += result.failCount;
      totalSkip += result.skipCount;

      // 爬取指定品牌
      for (const brand of BRANDS) {
        const brandResult = await crawlCategory(category.id, category.name, brand);
        totalSuccess += brandResult.successCount;
        totalFail += brandResult.failCount;
        totalSkip += brandResult.skipCount;
      }
    }

    console.log('\n📊 总体爬取完成:');
    console.log(`   ✅ 成功: ${totalSuccess}`);
    console.log(`   ⏭️ 跳过: ${totalSkip}`);
    console.log(`   ❌ 失败: ${totalFail}`);

  } catch (error) {
    console.error('❌ 爬虫异常:', error);
  } finally {
    await pool.end();
  }
}

main();
