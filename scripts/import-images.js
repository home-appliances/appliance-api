/**
 * 图片导入脚本
 * 从 URL 下载图片并存储为二进制数据到数据库
 *
 * 使用方法: node scripts/import-images.js
 * 可选参数:
 *   --batch-size=100    批次大小（默认 100）
 *   --concurrent=5      并发下载数量（默认 5）
 *   --resume            从中断处继续
 */

const { Pool } = require('pg');
const https = require('https');
const http = require('http');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 20,
});

// 配置参数
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100');
const CONCURRENT = parseInt(process.env.CONCURRENT || '5');
const RESUME = process.argv.includes('--resume');

let stats = {
  total: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now(),
};

/**
 * 下载图片并返回 Buffer
 */
function downloadImage(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // 跟随重定向
        downloadImage(res.headers.location, timeout)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

/**
 * 并发执行任务
 */
async function parallelLimit(tasks, limit) {
  const results = [];
  const executing = new Set();

  for (const task of tasks) {
    const p = task().then(result => {
      executing.delete(p);
      return result;
    });
    executing.add(p);
    results.push(p);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

/**
 * 处理单个产品的图片
 */
async function processProductImages(product) {
  const { id, images } = product;

  if (!images || images.length === 0) {
    return { id, status: 'skipped', reason: 'no images' };
  }

  try {
    const imageBuffers = await Promise.all(
      images.map(async (url) => {
        try {
          // 只下载 pconline 的图片
          if (!url || !url.includes('pconline.com.cn')) {
            return null;
          }
          const buffer = await downloadImage(url);
          return buffer;
        } catch (err) {
          return null;
        }
      })
    );

    // 过滤掉失败的图片
    const validBuffers = imageBuffers.filter(b => b !== null);

    if (validBuffers.length === 0) {
      return { id, status: 'failed', reason: 'all downloads failed' };
    }

    // 更新数据库
    await pool.query(
      'UPDATE products SET images_binary = $1 WHERE id = $2',
      [validBuffers, id]
    );

    return { id, status: 'success', count: validBuffers.length };
  } catch (err) {
    return { id, status: 'error', error: err.message };
  }
}

/**
 * 获取待处理的产品数量
 */
async function getPendingCount() {
  const result = await pool.query(`
    SELECT COUNT(*) as count
    FROM products
    WHERE images IS NOT NULL
      AND array_length(images, 1) > 0
      ${RESUME ? 'AND images_binary IS NULL' : ''}
  `);
  return parseInt(result.rows[0].count);
}

/**
 * 获取待处理的产品列表
 */
async function getPendingProducts(offset, limit) {
  const result = await pool.query(`
    SELECT id, images
    FROM products
    WHERE images IS NOT NULL
      AND array_length(images, 1) > 0
      ${RESUME ? 'AND images_binary IS NULL' : ''}
    ORDER BY id
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  return result.rows;
}

/**
 * 打印进度
 */
function printProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.processed / elapsed;
  const remaining = (stats.total - stats.processed) / rate;

  process.stdout.write(
    `\r📊 进度: ${stats.processed}/${stats.total} ` +
    `(${(stats.processed / stats.total * 100).toFixed(1)}%) | ` +
    `✅ ${stats.success} ❌ ${stats.failed} ⏭️ ${stats.skipped} | ` +
    `⏱️ ${elapsed.toFixed(0)}s | ` +
    `⏳ ${remaining.toFixed(0)}s 剩余`
  );
}

/**
 * 主函数
 */
async function main() {
  console.log('🖼️ 图片导入工具\n');
  console.log(`配置: 批次=${BATCH_SIZE}, 并发=${CONCURRENT}, 续传=${RESUME}\n`);

  try {
    // 获取总数
    stats.total = await getPendingCount();
    console.log(`📋 待处理产品: ${stats.total}\n`);

    if (stats.total === 0) {
      console.log('✅ 没有待处理的产品');
      return;
    }

    // 分批处理
    let offset = 0;
    while (offset < stats.total) {
      const products = await getPendingProducts(offset, BATCH_SIZE);

      if (products.length === 0) break;

      // 并发处理
      const tasks = products.map(p => () => processProductImages(p));
      const results = await parallelLimit(tasks, CONCURRENT);

      // 统计结果
      for (const result of results) {
        stats.processed++;
        if (result.status === 'fulfilled') {
          if (result.value.status === 'success') {
            stats.success++;
          } else if (result.value.status === 'skipped') {
            stats.skipped++;
          } else {
            stats.failed++;
          }
        } else {
          stats.failed++;
        }
      }

      printProgress();
      offset += BATCH_SIZE;
    }

    console.log('\n\n🎉 导入完成！');
    console.log(`   成功: ${stats.success}`);
    console.log(`   失败: ${stats.failed}`);
    console.log(`   跳过: ${stats.skipped}`);
    console.log(`   耗时: ${((Date.now() - stats.startTime) / 1000).toFixed(1)}秒`);

  } catch (error) {
    console.error('\n❌ 导入失败:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
