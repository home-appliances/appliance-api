/**
 * 修复占位图 - 查找并替换 default_logo.gif 等占位图
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

// 从详情页抓取真实图片URL
async function getImageFromDetailPage(detailUrl: string): Promise<string | null> {
  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    // 匹配产品主图（优先选择 _m 后缀的图片）
    const patterns = [
      /src="(\/\/img[^"]*_m\.jpg)"/,
      /src="(\/\/img[^"]*_m\.jpeg)"/,
      /src="(\/\/img[^"]*_sn\d*\.jpg)"/,
      /src="(\/\/img[^"]*_sn\d*\.jpeg)"/,
      /src="(\/\/img[^"]*\.jpg)"/,
      /src="(\/\/img[^"]*\.jpeg)"/,
      /src="(\/\/img[^"]*\.png)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }
        // 过滤掉非产品图片
        if ((url.includes('/product/') || url.includes('/upload/')) &&
            !url.includes('default_logo') &&
            !url.includes('_120x90') &&
            !url.includes('_60x60')) {
          return url;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// 从 zol 抓取图片
async function getImageFromZol(detailUrl: string): Promise<string | null> {
  try {
    const response = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const html = await response.text();

    // zol 图片匹配
    const patterns = [
      /src="(https?:\/\/[^"]*zol-img[^"]*\.jpg)"/,
      /src="(https?:\/\/[^"]*zol-img[^"]*\.jpeg)"/,
      /src="(https?:\/\/[^"]*zol-img[^"]*\.png)"/,
      /src="(\/\/[^"]*zol-img[^"]*\.jpg)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }
        if (!url.includes('default') && !url.includes('logo')) {
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
        'Referer': 'https://www.pconline.com.cn/',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 检查是否是有效图片（至少 5KB，排除占位图）
    if (buffer.length < 5120) return null;

    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch {
    return null;
  }
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找使用占位图的产品...\n');

    // 查找使用占位图的产品
    const result = await client.query(`
      SELECT p.id, p.name, p.brand, p.model, p.images, p.source_url, p.image_id
      FROM products p
      WHERE p.images[1] LIKE '%default_logo%'
         OR p.images[1] LIKE '%default%'
         OR p.images[1] LIKE '%placeholder%'
         OR (p.image_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM images i WHERE i.id = p.image_id AND octet_length(i.image_data) < 5120
         ))
      ORDER BY p.brand, p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品使用占位图\n`);

    // 统计各品牌数量
    const brandStats: Record<string, number> = {};
    for (const p of result.rows) {
      brandStats[p.brand] = (brandStats[p.brand] || 0) + 1;
    }
    console.log('各品牌占位图数量:');
    for (const [brand, count] of Object.entries(brandStats).sort((a, b) => b[1] - a[1])) {
      console.log(`  - ${brand}: ${count} 个`);
    }
    console.log('');

    let fixed = 0;
    let failed = 0;
    const failedList: Array<{ id: number; brand: string; model: string }> = [];

    for (const product of result.rows) {
      console.log(`📥 [${product.id}] ${product.brand} ${product.model || product.name}`);

      let imageUrl: string | null = null;

      // 尝试从详情页抓取
      if (product.source_url) {
        if (product.source_url.includes('zol')) {
          imageUrl = await getImageFromZol(product.source_url);
        } else {
          imageUrl = await getImageFromDetailPage(product.source_url);
        }
      }

      if (imageUrl) {
        console.log(`   找到图片: ${imageUrl}`);

        const imageData = await downloadImage(imageUrl);

        if (imageData) {
          // 更新图片记录
          if (product.image_id) {
            await client.query(
              'UPDATE images SET image_data = $1, mime_type = $2 WHERE id = $3',
              [imageData.buffer, imageData.mimeType, product.image_id]
            );
          } else {
            const imgResult = await client.query(
              'INSERT INTO images (image_data, mime_type) VALUES ($1, $2) RETURNING id',
              [imageData.buffer, imageData.mimeType]
            );
            await client.query(
              'UPDATE products SET image_id = $1 WHERE id = $2',
              [imgResult.rows[0].id, product.id]
            );
          }

          console.log(`   ✅ 成功! (${(imageData.buffer.length / 1024).toFixed(1)} KB)`);
          fixed++;
        } else {
          console.log(`   ❌ 下载失败或太小`);
          failed++;
          failedList.push({ id: product.id, brand: product.brand, model: product.model });
        }
      } else {
        console.log(`   ❌ 未找到真实图片`);
        failed++;
        failedList.push({ id: product.id, brand: product.brand, model: product.model });
      }

      // 避免限流
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n\n📊 修复完成统计:');
    console.log(`  - 成功修复: ${fixed} 张`);
    console.log(`  - 仍然失败: ${failed} 张`);

    if (failedList.length > 0 && failedList.length <= 50) {
      console.log('\n❌ 仍然失败的产品:');
      for (const item of failedList) {
        console.log(`  - [${item.id}] ${item.brand} ${item.model}`);
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
