/**
 * 下载缺失图片脚本
 * 直接从数据库中的图片 URL 下载
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
  max: 10,
});

// 从代理 URL 中提取真实图片地址
function extractRealImageUrl(url: string): string {
  if (!url) return url;

  if (url.includes('localhost:3000/api/image-proxy?url=')) {
    try {
      const urlObj = new URL(url);
      const realUrl = urlObj.searchParams.get('url');
      if (realUrl) {
        return decodeURIComponent(realUrl);
      }
    } catch {
      // 解析失败
    }
  }

  return url;
}

// 下载图片
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url || url.startsWith('data:')) return null;

  const realUrl = extractRealImageUrl(url);

  try {
    const response = await fetch(realUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.pconline.com.cn/',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.log(`     HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 检查是否是有效图片（至少 1KB）
    if (buffer.length < 1024) {
      console.log(`     文件太小: ${buffer.length} bytes`);
      return null;
    }

    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch (error: any) {
    console.log(`     错误: ${error.message}`);
    return null;
  }
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找图片缺失的产品...\n');

    // 查找没有 image_id 或 image_id 对应的图片不存在的产品
    const result = await client.query(`
      SELECT p.id, p.name, p.brand, p.model, p.images
      FROM products p
      WHERE p.image_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
      ORDER BY p.brand, p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品需要下载图片\n`);

    let fixed = 0;
    let failed = 0;
    const failedList: Array<{ id: number; name: string; reason: string }> = [];

    for (const product of result.rows) {
      const imageUrl = product.images && product.images.length > 0 ? product.images[0] : null;

      if (!imageUrl) {
        console.log(`⏭️ [${product.id}] ${product.name || product.model} - 无图片URL`);
        failed++;
        failedList.push({ id: product.id, name: product.name || product.model, reason: '无图片URL' });
        continue;
      }

      console.log(`📥 [${product.id}] ${product.name || product.model}`);
      console.log(`   URL: ${imageUrl}`);

      const imageData = await downloadImage(imageUrl);

      if (imageData) {
        // 插入图片记录
        const imgResult = await client.query(
          'INSERT INTO images (image_data, mime_type) VALUES ($1, $2) RETURNING id',
          [imageData.buffer, imageData.mimeType]
        );
        const imageId = imgResult.rows[0].id;

        // 更新产品记录
        await client.query(
          'UPDATE products SET image_id = $1 WHERE id = $2',
          [imageId, product.id]
        );

        console.log(`   ✅ 成功 (${(imageData.buffer.length / 1024).toFixed(1)} KB)`);
        fixed++;
      } else {
        console.log(`   ❌ 失败`);
        failed++;
        failedList.push({ id: product.id, name: product.name || product.model, reason: '下载失败' });
      }
    }

    console.log('\n\n📊 下载完成统计:');
    console.log(`  - 成功下载: ${fixed} 张`);
    console.log(`  - 下载失败: ${failed} 张`);

    if (failedList.length > 0) {
      console.log('\n❌ 下载失败列表:');
      for (const item of failedList) {
        console.log(`  - [${item.id}] ${item.name}: ${item.reason}`);
      }
    }

    // 最终统计
    const totalResult = await client.query('SELECT COUNT(*) FROM products');
    const withImageResult = await client.query(`
      SELECT COUNT(*) FROM products p
      WHERE EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
    `);

    console.log('\n📊 数据库最终统计:');
    console.log(`  - 产品总数: ${totalResult.rows[0].count}`);
    console.log(`  - 有图片产品: ${withImageResult.rows[0].count}`);
    console.log(`  - 图片覆盖率: ${((parseInt(withImageResult.rows[0].count) / parseInt(totalResult.rows[0].count)) * 100).toFixed(2)}%`);

  } catch (error) {
    console.error('❌ 下载失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
