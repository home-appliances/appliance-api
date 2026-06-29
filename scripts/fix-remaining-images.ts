/**
 * 修复剩余缺失图片 - 使用 _sn 后缀和详情页抓取
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

// 获取所有可能的图片URL变体
function getImageUrlVariants(url: string): string[] {
  if (!url) return [];

  const variants: string[] = [];
  const baseName = url.replace(/\.(jpg|jpeg|png)$/i, '');
  const ext = url.match(/\.(jpg|jpeg|png)$/i)?.[1] || 'jpg';

  // 原始URL
  variants.push(url);

  // _m 后缀
  variants.push(`${baseName}_m.${ext}`);

  // _sn1, _sn2 后缀
  variants.push(`${baseName}_sn1.${ext}`);
  variants.push(`${baseName}_sn2.${ext}`);

  // _sn8 后缀
  variants.push(`${baseName}_sn8.${ext}`);

  return [...new Set(variants)];
}

// 从详情页抓取图片URL
async function getImageFromDetailPage(detailUrl: string): Promise<string[]> {
  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const urls: string[] = [];

    // 匹配所有图片URL
    const patterns = [
      /src="(\/\/img[^"]*_sn\d*\.jpg)"/g,
      /src="(\/\/img[^"]*_m\.jpg)"/g,
      /src="(\/\/img[^"]*\.jpg)"/g,
      /src="(\/\/img[^"]*_sn\d*\.jpeg)"/g,
      /src="(\/\/img[^"]*_m\.jpeg)"/g,
      /src="(\/\/img[^"]*\.jpeg)"/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let url = match[1];
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }
        // 过滤掉非产品图片（缩略图、广告等）
        if ((url.includes('/product/') || url.includes('/upload/')) &&
            !url.includes('_120x90') && !url.includes('_60x60')) {
          urls.push(url);
        }
      }
    }

    return [...new Set(urls)];
  } catch {
    return [];
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
      SELECT p.id, p.name, p.brand, p.model, p.images, p.source_url
      FROM products p
      WHERE p.image_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
      ORDER BY p.brand, p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品需要修复图片\n`);

    let fixed = 0;
    let failed = 0;

    for (const product of result.rows) {
      const imageUrl = product.images && product.images.length > 0 ? product.images[0] : null;

      console.log(`📥 [${product.id}] ${product.name || product.model}`);

      let downloaded = false;

      // 1. 先尝试URL变体
      if (imageUrl) {
        const urlVariants = getImageUrlVariants(imageUrl);
        for (const url of urlVariants) {
          const imageData = await downloadImage(url);
          if (imageData) {
            const imgResult = await client.query(
              'INSERT INTO images (image_data, mime_type) VALUES ($1, $2) RETURNING id',
              [imageData.buffer, imageData.mimeType]
            );
            await client.query('UPDATE products SET image_id = $1 WHERE id = $2', [imgResult.rows[0].id, product.id]);
            console.log(`   ✅ URL变体成功: ${url} (${(imageData.buffer.length / 1024).toFixed(1)} KB)`);
            fixed++;
            downloaded = true;
            break;
          }
        }
      }

      // 2. 如果URL变体都失败，尝试从详情页抓取
      if (!downloaded && product.source_url) {
        console.log(`   尝试从详情页抓取...`);
        const detailUrls = await getImageFromDetailPage(product.source_url);

        for (const url of detailUrls) {
          const imageData = await downloadImage(url);
          if (imageData) {
            const imgResult = await client.query(
              'INSERT INTO images (image_data, mime_type) VALUES ($1, $2) RETURNING id',
              [imageData.buffer, imageData.mimeType]
            );
            await client.query('UPDATE products SET image_id = $1 WHERE id = $2', [imgResult.rows[0].id, product.id]);
            console.log(`   ✅ 详情页抓取成功: ${url} (${(imageData.buffer.length / 1024).toFixed(1)} KB)`);
            fixed++;
            downloaded = true;
            break;
          }
        }
      }

      if (!downloaded) {
        console.log(`   ❌ 失败`);
        failed++;
      }

      // 避免限流
      await new Promise(resolve => setTimeout(resolve, 500));
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

    // 列出仍然失败的产品
    if (failed > 0) {
      console.log('\n❌ 仍然失败的产品:');
      const failedResult = await client.query(`
        SELECT p.id, p.name, p.brand, p.model, p.images, p.source_url
        FROM products p
        WHERE p.image_id IS NULL
           OR NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
        ORDER BY p.id
      `);
      for (const p of failedResult.rows) {
        console.log(`  - [${p.id}] ${p.brand}/${p.model || p.name}`);
        if (p.source_url) console.log(`    详情页: ${p.source_url}`);
      }
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
