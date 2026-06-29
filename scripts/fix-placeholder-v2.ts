/**
 * 修复占位图 V2 - 更激进的方法
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

// 从详情页抓取所有图片URL
async function getAllImagesFromPage(detailUrl: string): Promise<string[]> {
  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const urls: string[] = [];

    // 匹配所有图片URL
    const regex = /(?:src|data-src|data-lazyload)=["'](\/\/[^"']*\.(?:jpg|jpeg|png|webp))["']/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      let url = match[1];
      if (url.startsWith('//')) {
        url = 'https:' + url;
      }
      // 过滤掉明显不是产品图的
      if (!url.includes('logo') &&
          !url.includes('icon') &&
          !url.includes('avatar') &&
          !url.includes('_120x90') &&
          !url.includes('_60x60') &&
          !url.includes('advertisement') &&
          (url.includes('/product/') || url.includes('/upload/') || url.includes('pconline') || url.includes('zol'))) {
        urls.push(url);
      }
    }

    return [...new Set(urls)];
  } catch {
    return [];
  }
}

// 下载图片
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://product.pconline.com.cn/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 至少 3KB
    if (buffer.length < 3072) return null;

    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch {
    return null;
  }
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找需要修复的产品...\n');

    // 查找占位图或小图的产品
    const result = await client.query(`
      SELECT p.id, p.name, p.brand, p.model, p.source_url, p.image_id
      FROM products p
      LEFT JOIN images i ON p.image_id = i.id
      WHERE p.source_url IS NOT NULL
        AND (
          p.images[1] LIKE '%default%'
          OR p.images[1] LIKE '%placeholder%'
          OR p.images[1] LIKE '%logo%'
          OR (i.image_data IS NOT NULL AND octet_length(i.image_data) < 5120)
          OR p.image_id IS NULL
        )
      ORDER BY p.brand, p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品需要检查\n`);

    let fixed = 0;
    let failed = 0;
    let skipped = 0;

    for (const product of result.rows) {
      process.stdout.write(`[${product.id}] ${product.brand} ${product.model || ''} ... `);

      // 从详情页获取所有图片
      const imageUrls = await getAllImagesFromPage(product.source_url);

      if (imageUrls.length === 0) {
        console.log('❌ 详情页无图片');
        failed++;
        continue;
      }

      let downloaded = false;

      // 尝试下载每张图片，找到最大的
      let bestImage: { buffer: Buffer; mimeType: string } | null = null;
      let bestUrl = '';

      for (const url of imageUrls) {
        const image = await downloadImage(url);
        if (image && (!bestImage || image.buffer.length > bestImage.buffer.length)) {
          bestImage = image;
          bestUrl = url;
        }
      }

      if (bestImage && bestImage.buffer.length >= 3072) {
        // 更新图片
        if (product.image_id) {
          await client.query(
            'UPDATE images SET image_data = $1, mime_type = $2 WHERE id = $3',
            [bestImage.buffer, bestImage.mimeType, product.image_id]
          );
        } else {
          const imgResult = await client.query(
            'INSERT INTO images (image_data, mime_type) VALUES ($1, $2) RETURNING id',
            [bestImage.buffer, bestImage.mimeType]
          );
          await client.query(
            'UPDATE products SET image_id = $1 WHERE id = $2',
            [imgResult.rows[0].id, product.id]
          );
        }
        console.log(`✅ ${(bestImage.buffer.length / 1024).toFixed(1)} KB`);
        fixed++;
      } else {
        console.log('❌ 无合适图片');
        failed++;
      }

      // 避免限流
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n\n📊 修复完成统计:');
    console.log(`  - 成功修复: ${fixed} 张`);
    console.log(`  - 失败: ${failed} 张`);
    console.log(`  - 跳过: ${skipped} 张`);

    // 最终统计
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN EXISTS (SELECT 1 FROM images i WHERE i.id = p.image_id AND octet_length(i.image_data) >= 5120) THEN 1 END) as good_images,
        COUNT(CASE WHEN EXISTS (SELECT 1 FROM images i WHERE i.id = p.image_id AND octet_length(i.image_data) < 5120) THEN 1 END) as small_images,
        COUNT(CASE WHEN p.image_id IS NULL THEN 1 END) as no_image
      FROM products p
    `);

    const s = stats.rows[0];
    console.log('\n📊 数据库最终统计:');
    console.log(`  - 产品总数: ${s.total}`);
    console.log(`  - 正常图片 (≥5KB): ${s.good_images}`);
    console.log(`  - 小图 (<5KB): ${s.small_images}`);
    console.log(`  - 无图片: ${s.no_image}`);

  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
