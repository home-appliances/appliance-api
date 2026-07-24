/**
 * 批量下载产品主图入库
 * 从 product_images 表取 main 类型的 image_url，
 * 下载图片存入 images 表，更新 products.main_image 和 image_id
 *
 * 运行: npx tsx scripts/import-main-images.ts
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

const DOWNLOAD_TIMEOUT = 30000;
const CONCURRENCY = 5;

async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://detail.zol.com.cn/'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  ⚠️ 下载失败 (${response.status}): ${url.substring(0, 60)}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      console.log(`  ⚠️ 图片过小: ${buffer.length} bytes`);
      return null;
    }

    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    let mimeType = contentType.split(';')[0].trim();

    if (mimeType === 'application/octet-stream' || !mimeType.startsWith('image/')) {
      const urlLower = url.toLowerCase();
      if (urlLower.endsWith('.png')) mimeType = 'image/png';
      else if (urlLower.endsWith('.webp')) mimeType = 'image/webp';
      else if (urlLower.endsWith('.gif')) mimeType = 'image/gif';
      else mimeType = 'image/jpeg';
    }

    return { buffer, mimeType };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.log(`  ⏱️ 超时: ${url.substring(0, 60)}`);
    } else {
      console.log(`  ❌ 错误: ${error.message}`);
    }
    return null;
  }
}

async function processProduct(product: any): Promise<boolean> {
  const { id, name, image_url } = product;

  const existing = await pool.query(
    'SELECT id FROM images WHERE source_url = $1',
    [image_url]
  );

  let imageId: number;

  if (existing.rows.length > 0) {
    imageId = existing.rows[0].id;
  } else {
    const result = await downloadImage(image_url);
    if (!result) return false;

    const insertResult = await pool.query(`
      INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (source_url) DO UPDATE SET source_url = EXCLUDED.source_url
      RETURNING id
    `, [result.buffer, result.mimeType, result.buffer.length, image_url]);

    imageId = insertResult.rows[0].id;
  }

  await pool.query(
    "UPDATE products SET image_id = $1, main_image = $2, updated_at = NOW() WHERE id = $3",
    [imageId, `/api/image/${imageId}`, id]
  );

  return true;
}

async function main() {
  console.log('🚀 开始批量下载产品主图入库\n');

  const result = await pool.query(`
    SELECT p.id, p.name, pi.image_url
    FROM products p
    JOIN product_images pi ON pi.product_id = p.id AND pi.image_type = 'main'
    WHERE p.main_image IS NULL
       OR p.main_image NOT LIKE '/api/image%'
    ORDER BY p.id
  `);

  const products = result.rows;
  console.log(`📊 找到 ${products.length} 个需要下载图片的产品\n`);

  if (products.length === 0) {
    console.log('✅ 没有需要处理的产品');
    await pool.end();
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const batch = products.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(p =>
      processProduct(p).then(r => ({ r, p }))
    ));

    results.forEach(({ r, p }) => {
      if (r) {
        success++;
        if (success % 50 === 0) {
          console.log(`  ✅ [${i + results.indexOf({ r, p }) + 1}/${products.length}] ${p.name.substring(0, 30)}`);
        }
      } else {
        failed++;
      }
    });

    const progress = Math.min(i + CONCURRENCY, products.length);
    const percent = ((progress / products.length) * 100).toFixed(1);
    process.stdout.write(`\r⏳ 进度: ${progress}/${products.length} (${percent}%) | ✅${success} ❌${failed}`);
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('📊 导入统计:');
  console.log(`   ✅ 成功: ${success}`);
  console.log(`   ❌ 失败: ${failed}`);
  console.log('='.repeat(50));

  const verify = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(image_id) as with_image,
      COUNT(*) - COUNT(image_id) as without_image
    FROM products
  `);
  const s = verify.rows[0];
  console.log(`\n📋 产品图片统计:`);
  console.log(`   总产品数: ${s.total}`);
  console.log(`   有图片: ${s.with_image}`);
  console.log(`   无图片: ${s.without_image}`);

  await pool.end();
  console.log('\n✨ 完成！');
}

main().catch((error) => {
  console.error('❌ 执行失败:', error);
  process.exit(1);
});
