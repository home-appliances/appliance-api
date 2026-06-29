/**
 * 从 zol 抓取产品图片
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

// 从 zol 详情页抓取图片
async function getImageFromZol(detailUrl: string): Promise<string | null> {
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

    // zol 图片匹配 - 产品主图
    const patterns = [
      // 大图
      /src="(https?:\/\/[^"]*zol-img[^"]*_\d+x\d+[^"]*\.jpg)"/,
      // 产品图
      /src="(https?:\/\/[^"]*zol-img[^"]*\/product[^"]*\.jpg)"/,
      // 其他格式
      /src="(\/\/[^"]*zol-img[^"]*\.jpg)"/,
      /src="(\/\/[^"]*zol-img[^"]*\.jpeg)"/,
      /src="(\/\/[^"]*zol-img[^"]*\.png)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let url = match[1];
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }
        // 过滤掉明显不是产品图的
        if (!url.includes('default') && !url.includes('logo') && !url.includes('icon')) {
          return url;
        }
      }
    }

    // 尝试匹配 data-src
    const dataSrcMatch = html.match(/data-src="(\/\/[^"]*zol-img[^"]*\.jpg)"/);
    if (dataSrcMatch && dataSrcMatch[1]) {
      return 'https:' + dataSrcMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

// 下载图片
async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://detail.zol.com.cn/',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 至少 5KB
    if (buffer.length < 5120) return null;

    return { buffer, mimeType: contentType.split(';')[0].trim() };
  } catch {
    return null;
  }
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找 zol 详情页的小图产品...\n');

    const result = await client.query(`
      SELECT p.id, p.brand, p.model, p.source_url, p.image_id
      FROM products p
      JOIN images i ON p.image_id = i.id
      WHERE octet_length(i.image_data) < 5120
        AND p.source_url LIKE '%zol%'
      ORDER BY p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个 zol 产品需要修复\n`);

    let fixed = 0;
    let failed = 0;

    for (const product of result.rows) {
      process.stdout.write(`[${product.id}] ${product.brand} ${product.model} ... `);

      const imageUrl = await getImageFromZol(product.source_url);

      if (imageUrl) {
        const imageData = await downloadImage(imageUrl);

        if (imageData) {
          await client.query(
            'UPDATE images SET image_data = $1, mime_type = $2 WHERE id = $3',
            [imageData.buffer, imageData.mimeType, product.image_id]
          );
          console.log(`✅ ${(imageData.buffer.length / 1024).toFixed(1)} KB`);
          fixed++;
        } else {
          console.log('❌ 下载失败');
          failed++;
        }
      } else {
        console.log('❌ 未找到图片');
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 修复完成统计:');
    console.log(`  - 成功修复: ${fixed} 张`);
    console.log(`  - 失败: ${failed} 张`);

    // 最终统计
    const stats = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN octet_length(i.image_data) >= 5120 THEN 1 END) as good_images,
        COUNT(CASE WHEN octet_length(i.image_data) < 5120 THEN 1 END) as small_images
      FROM products p
      JOIN images i ON p.image_id = i.id
    `);

    const s = stats.rows[0];
    console.log('\n📊 数据库最终统计:');
    console.log(`  - 产品总数: ${s.total}`);
    console.log(`  - 正常图片 (≥5KB): ${s.good_images}`);
    console.log(`  - 小图 (<5KB): ${s.small_images}`);

  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
