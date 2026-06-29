/**
 * 修复缺失图片脚本
 * 下载数据库中图片缺失的产品图片
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
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 检查是否是有效图片（至少 1KB）
    if (buffer.length < 1024) return null;

    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch (error) {
    return null;
  }
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找图片缺失的产品...\n');

    // 查找没有图片记录或图片 URL 为空的产品
    const result = await client.query(`
      SELECT p.id, p.name, p.images, p.image_id
      FROM products p
      WHERE p.image_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
      ORDER BY p.id
      LIMIT 1000
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品需要修复图片\n`);

    let fixed = 0;
    let failed = 0;
    const failedList: Array<{ id: number; name: string; url: string }> = [];

    for (const product of result.rows) {
      const imageUrl = product.images && product.images.length > 0 ? product.images[0] : null;

      if (!imageUrl) {
        console.log(`  ⏭️ 跳过 ${product.id}: ${product.name} (无图片URL)`);
        failed++;
        failedList.push({ id: product.id, name: product.name, url: '无URL' });
        continue;
      }

      console.log(`  📥 下载 ${product.id}: ${product.name}`);
      console.log(`     URL: ${imageUrl}`);

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

        console.log(`     ✅ 成功 (${(imageData.buffer.length / 1024).toFixed(1)} KB)`);
        fixed++;
      } else {
        console.log(`     ❌ 失败`);
        failed++;
        failedList.push({ id: product.id, name: product.name, url: imageUrl });
      }
    }

    console.log('\n📊 修复完成统计:');
    console.log(`  - 成功修复: ${fixed} 张`);
    console.log(`  - 下载失败: ${failed} 张`);

    if (failedList.length > 0 && failedList.length <= 100) {
      console.log('\n❌ 下载失败列表:');
      failedList.forEach((item, index) => {
        console.log(`  ${index + 1}. [${item.id}] ${item.name}`);
        console.log(`     ${item.url}`);
      });
    }

  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
