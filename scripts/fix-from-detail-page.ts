/**
 * 从详情页抓取图片
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

// 从详情页抓取图片URL
async function getImageFromDetailPage(detailUrl: string): Promise<string | null> {
  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    // 匹配产品图片URL
    const patterns = [
      /src="(\/\/img[^"]*_m\.jpg)"/,
      /src="(\/\/img[^"]*_m\.jpeg)"/,
      /src="(\/\/img[^"]*_m\.png)"/,
      /src="(https?:\/\/img[^"]*_m\.jpg)"/,
      /src="(\/\/img[^"]*\.jpg)"/,
      /src="(\/\/img[^"]*\.jpeg)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }
        // 过滤掉非产品图片
        if (url.includes('/product/') || url.includes('/upload/')) {
          return url;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// 下载图片
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url || url.startsWith('data:')) return null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://product.pconline.com.cn/',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 1024) return null;

    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch {
    return null;
  }
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找图片缺失的产品...\n');

    const result = await client.query(`
      SELECT p.id, p.name, p.brand, p.model, p.source_url
      FROM products p
      WHERE p.image_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
      ORDER BY p.brand, p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品需要修复图片\n`);

    let fixed = 0;
    let failed = 0;

    for (const product of result.rows) {
      if (!product.source_url) {
        console.log(`⏭️ [${product.id}] ${product.name || product.model} - 无详情页URL`);
        failed++;
        continue;
      }

      console.log(`📥 [${product.id}] ${product.name || product.model}`);
      console.log(`   详情页: ${product.source_url}`);

      // 从详情页抓取图片URL
      const imageUrl = await getImageFromDetailPage(product.source_url);

      if (!imageUrl) {
        console.log(`   ❌ 详情页未找到图片`);
        failed++;
        continue;
      }

      console.log(`   找到图片: ${imageUrl}`);

      // 下载图片
      const imageData = await downloadImage(imageUrl);

      if (imageData) {
        const imgResult = await client.query(
          'INSERT INTO images (image_data, mime_type) VALUES ($1, $2) RETURNING id',
          [imageData.buffer, imageData.mimeType]
        );
        const imageId = imgResult.rows[0].id;

        await client.query(
          'UPDATE products SET image_id = $1 WHERE id = $2',
          [imageId, product.id]
        );

        console.log(`   ✅ 成功! (${(imageData.buffer.length / 1024).toFixed(1)} KB)`);
        fixed++;
      } else {
        console.log(`   ❌ 下载失败`);
        failed++;
      }
    }

    console.log('\n\n📊 修复完成统计:');
    console.log(`  - 成功修复: ${fixed} 张`);
    console.log(`  - 仍然失败: ${failed} 张`);

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
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
