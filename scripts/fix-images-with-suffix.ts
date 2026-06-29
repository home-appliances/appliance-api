/**
 * 修复缺失图片 - 尝试 _m 后缀
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

// 尝试不同的图片URL变体
function getImageUrlVariants(url: string): string[] {
  if (!url) return [];

  const variants: string[] = [];

  // 1. 原始URL
  variants.push(url);

  // 2. 添加 _m 后缀 (在 .jpg 之前)
  if (url.endsWith('.jpg')) {
    variants.push(url.replace('.jpg', '_m.jpg'));
  }
  if (url.endsWith('.jpeg')) {
    variants.push(url.replace('.jpeg', '_m.jpeg'));
  }
  if (url.endsWith('.png')) {
    variants.push(url.replace('.png', '_m.png'));
  }

  // 3. 如果URL包含 localhost proxy，提取真实URL
  if (url.includes('localhost:3000/api/image-proxy?url=')) {
    try {
      const urlObj = new URL(url);
      const realUrl = urlObj.searchParams.get('url');
      if (realUrl) {
        const decoded = decodeURIComponent(realUrl);
        variants.push(decoded);
        if (decoded.endsWith('.jpg')) {
          variants.push(decoded.replace('.jpg', '_m.jpg'));
        }
      }
    } catch {
      // 解析失败
    }
  }

  return [...new Set(variants)]; // 去重
}

// 下载图片
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url || url.startsWith('data:')) return null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://product.pconline.com.cn/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
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
  } catch {
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

    console.log(`📊 找到 ${result.rows.length} 个产品需要修复图片\n`);

    let fixed = 0;
    let failed = 0;
    const failedList: Array<{ id: number; name: string; triedUrls: string[] }> = [];

    for (const product of result.rows) {
      const imageUrl = product.images && product.images.length > 0 ? product.images[0] : null;

      if (!imageUrl) {
        console.log(`⏭️ [${product.id}] ${product.name || product.model} - 无图片URL`);
        failed++;
        failedList.push({ id: product.id, name: product.name || product.model, triedUrls: [] });
        continue;
      }

      console.log(`📥 [${product.id}] ${product.name || product.model}`);

      // 获取所有可能的URL变体
      const urlVariants = getImageUrlVariants(imageUrl);
      let downloaded = false;

      for (const url of urlVariants) {
        console.log(`   尝试: ${url}`);

        const imageData = await downloadImage(url);

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

          console.log(`   ✅ 成功! (${(imageData.buffer.length / 1024).toFixed(1)} KB)`);
          fixed++;
          downloaded = true;
          break;
        }
      }

      if (!downloaded) {
        console.log(`   ❌ 所有变体都失败`);
        failed++;
        failedList.push({ id: product.id, name: product.name || product.model, triedUrls: urlVariants });
      }
    }

    console.log('\n\n📊 修复完成统计:');
    console.log(`  - 成功修复: ${fixed} 张`);
    console.log(`  - 仍然失败: ${failed} 张`);

    if (failedList.length > 0) {
      console.log('\n❌ 仍然失败的产品:');
      for (const item of failedList) {
        console.log(`  - [${item.id}] ${item.name}`);
        if (item.triedUrls.length > 0) {
          console.log(`    尝试过的URL:`);
          item.triedUrls.forEach(url => console.log(`      ${url}`));
        }
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
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
