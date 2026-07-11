/**
 * 批量导入图片脚本
 * 将产品表中 URL 图片下载并存储到 images 表
 *
 * 运行: npx tsx src/db/import-images.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// 下载超时时间（毫秒）
const DOWNLOAD_TIMEOUT = 30000;

// 并发下载数量
const CONCURRENCY = 3;

/**
 * 下载图片并返回 Buffer
 */
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://product.pconline.com.cn/'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  ⚠️ 下载失败 (${response.status}): ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 检测 MIME 类型
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    let mimeType = contentType.split(';')[0].trim();

    if (mimeType === 'application/octet-stream' || !mimeType.startsWith('image/')) {
      const urlLower = url.toLowerCase();
      if (urlLower.endsWith('.png')) mimeType = 'image/png';
      else if (urlLower.endsWith('.gif')) mimeType = 'image/gif';
      else if (urlLower.endsWith('.webp')) mimeType = 'image/webp';
      else mimeType = 'image/jpeg';
    }

    return { buffer, mimeType };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`  ⏱️ 下载超时: ${url}`);
    } else {
      console.log(`  ❌ 下载错误: ${url}`, error.message);
    }
    return null;
  }
}

/**
 * 处理单个产品
 */
async function processProduct(product: any): Promise<boolean> {
  const { id, name, images, image_id } = product;

  // 跳过已有 image_id 的产品
  if (image_id) {
    return false;
  }

  // 获取图片 URL（从 images 数组）
  const imageUrls = images || [];
  if (imageUrls.length === 0) {
    return false;
  }

  // 只处理第一张图片（主图）
  const mainImageUrl = imageUrls[0];
  if (!mainImageUrl || mainImageUrl.startsWith('data:')) {
    return false;
  }

  console.log(`\n📦 处理产品: ${name} (ID: ${id})`);
  console.log(`   图片: ${mainImageUrl}`);

  // 1. 检查是否已存在
  const existing = await pool.query(
    'SELECT id FROM images WHERE source_url = $1',
    [mainImageUrl]
  );

  let imageId: number;

  if (existing.rows.length > 0) {
    imageId = existing.rows[0].id;
    console.log(`   ✅ 图片已存在，ID: ${imageId}`);
  } else {
    // 2. 下载图片
    const result = await downloadImage(mainImageUrl);
    if (!result) {
      return false;
    }

    // 3. 存入数据库
    const insertResult = await pool.query(`
      INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [result.buffer, result.mimeType, result.buffer.length, mainImageUrl]);

    imageId = insertResult.rows[0].id;
    console.log(`   ✅ 图片已保存，ID: ${imageId}, 大小: ${(result.buffer.length / 1024).toFixed(1)}KB`);
  }

  // 4. 关联到产品
  await pool.query(
    'UPDATE products SET image_id = $1 WHERE id = $2',
    [imageId, id]
  );
  console.log(`   ✅ 已关联到产品`);

  return true;
}

/**
 * 批量处理（带并发控制）
 */
async function batchProcess(products: any[]): Promise<{ success: number; failed: number; skipped: number }> {
  let success = 0;
  let failed = 0;
  let skipped = 0;

  // 分批处理
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(processProduct));

    results.forEach(result => {
      if (result === true) success++;
      else if (result === false) skipped++;
      else failed++;
    });

    // 显示进度
    const progress = Math.min(i + CONCURRENCY, products.length);
    const percent = ((progress / products.length) * 100).toFixed(1);
    process.stdout.write(`\r⏳ 进度: ${progress}/${products.length} (${percent}%)`);
  }

  console.log(''); // 换行

  return { success, failed, skipped };
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始批量导入图片\n');

  // 1. 获取所有需要处理的产品
  const result = await pool.query(`
    SELECT id, name, images, image_id
    FROM products
    WHERE image_id IS NULL
      AND images IS NOT NULL
      AND array_length(images, 1) > 0
    ORDER BY id
  `);

  const products = result.rows;
  console.log(`📊 找到 ${products.length} 个需要导入图片的产品\n`);

  if (products.length === 0) {
    console.log('✅ 没有需要处理的产品');
    await pool.end();
    return;
  }

  // 2. 批量处理
  const stats = await batchProcess(products);

  // 3. 输出统计
  console.log('\n' + '='.repeat(50));
  console.log('📊 导入统计:');
  console.log(`   ✅ 成功: ${stats.success}`);
  console.log(`   ⏭️  跳过: ${stats.skipped}`);
  console.log(`   ❌ 失败: ${stats.failed}`);
  console.log('='.repeat(50));

  // 4. 验证结果
  const verifyResult = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(image_id) as with_image,
      COUNT(*) - COUNT(image_id) as without_image
    FROM products
  `);

  const stats2 = verifyResult.rows[0];
  console.log('\n📋 产品图片统计:');
  console.log(`   总产品数: ${stats2.total}`);
  console.log(`   有图片: ${stats2.with_image}`);
  console.log(`   无图片: ${stats2.without_image}`);

  await pool.end();
  console.log('\n✨ 完成！');
}

// 运行
main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
