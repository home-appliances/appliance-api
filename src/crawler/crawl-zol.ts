/**
 * ZOL 空调爬虫入口
 * 使用方法: npm run crawl:zol
 */

import { ZolClient } from './sources/zol-client';
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

const zolClient = new ZolClient();

// 配置
const CONFIG = {
  // 需要爬取的产品ID列表（从页面分析获取）
  productIds: [
    '2109385', '1438530', '2117831', '2117832', '1258493',
    '2099782', '1438528', '1140384', '2123496', '1631464',
    '1364478', '1392361', '1185628', '1303510',
  ],
  // 并发限制
  concurrency: 3,
  // 重试次数
  maxRetries: 3,
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
        'air_condition',
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
 * 主函数
 */
async function main() {
  console.log('🕷️ ZOL 空调爬虫启动\n');
  console.log(`配置: 并发=${CONFIG.concurrency}, 重试=${CONFIG.maxRetries}\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    // 逐个爬取产品
    for (const productId of CONFIG.productIds) {
      console.log(`📥 爬取产品: ${productId}`);

      let retries = 0;
      let success = false;

      while (retries < CONFIG.maxRetries && !success) {
        try {
          const product = await zolClient.getProductDetail(productId);
          if (product) {
            const saved = await saveProduct(product);
            if (saved) {
              successCount++;
            } else {
              skipCount++;
            }
            success = true;
          } else {
            console.log(`   ⚠️ 产品不存在: ${productId}`);
            skipCount++;
            success = true;
          }
        } catch (error) {
          retries++;
          if (retries < CONFIG.maxRetries) {
            console.log(`   ⚠️ 重试 ${retries}/${CONFIG.maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          } else {
            console.error(`   ❌ 爬取失败: ${productId}`, error);
            failCount++;
          }
        }
      }

      // 限流
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 爬取完成:');
    console.log(`   ✅ 成功: ${successCount}`);
    console.log(`   ⏭️ 跳过: ${skipCount}`);
    console.log(`   ❌ 失败: ${failCount}`);

  } catch (error) {
    console.error('❌ 爬虫异常:', error);
  } finally {
    await pool.end();
  }
}

main();
