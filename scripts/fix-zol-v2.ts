/**
 * 从 zol 抓取图片 V2 - 使用不同的方法
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

// 从 zol 详情页抓取图片 - 改进版
async function getImageFromZolV2(detailUrl: string): Promise<string[]> {
  try {
    // 先访问详情页获取 cookie
    const pageResponse = await fetch(detailUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!pageResponse.ok) return [];

    const html = await pageResponse.text();
    const cookie = pageResponse.headers.get('set-cookie') || '';
    const urls: string[] = [];

    // 匹配所有可能的图片URL
    const patterns = [
      // zol 标准产品图
      /"(https?:\/\/[^"]*zol-img[^"]*\.jpg)"/g,
      /"(\/\/[^"]*zol-img[^"]*\.jpg)"/g,
      // data-src 懒加载图片
      /data-src="(\/\/[^"]*\.jpg)"/g,
      /data-src="(https?:\/\/[^"]*\.jpg)"/g,
      // src 属性
      /src="(\/\/[^"]*zol[^"]*\.jpg)"/g,
      /src="(https?:\/\/[^"]*zol[^"]*\.jpg)"/g,
      // 其他CDN
      /src="(\/\/[^"]*\.zol\.com[^"]*\.jpg)"/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let url = match[1];
        if (url.startsWith('//')) {
          url = 'https:' + url;
        }
        // 过滤掉明显不是产品图的
        if (!url.includes('default') &&
            !url.includes('logo') &&
            !url.includes('icon') &&
            !url.includes('avatar') &&
            !url.includes('ad_') &&
            !url.includes('banner') &&
            !url.includes('_60x60') &&
            !url.includes('_80x80') &&
            !url.includes('_120x90')) {
          urls.push(url);
        }
      }
    }

    return [...new Set(urls)];
  } catch {
    return [];
  }
}

// 下载图片 - 带 cookie
async function downloadImageWithReferer(url: string, referer: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!url) return null;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
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

// 尝试从其他来源搜索图片
async function searchImageFromOtherSources(brand: string, model: string): Promise<string | null> {
  // 尝试从百度图片搜索
  const searchUrl = `https://image.baidu.com/search/acjson?tn=resultjson_com&word=${encodeURIComponent(brand + ' ' + model + ' 空调')}&pn=0&rn=5`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const text = await response.text();
    // 尝试解析 JSON
    const data = JSON.parse(text);

    if (data.data && data.data.length > 0) {
      for (const item of data.data) {
        if (item.thumbURL && item.thumbURL.length > 5000) {
          return item.thumbURL;
        }
      }
    }
  } catch {
    // 解析失败
  }

  return null;
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找需要修复的小图产品...\n');

    const result = await client.query(`
      SELECT p.id, p.brand, p.model, p.name, p.source_url, p.image_id
      FROM products p
      JOIN images i ON p.image_id = i.id
      WHERE octet_length(i.image_data) < 5120
      ORDER BY p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品需要修复\n`);

    let fixed = 0;
    let failed = 0;

    for (const product of result.rows) {
      process.stdout.write(`[${product.id}] ${product.brand} ${product.model} ... `);

      let imageData: { buffer: Buffer; mimeType: string } | null = null;

      // 方法1: 从 zol 详情页抓取
      if (product.source_url && product.source_url.includes('zol')) {
        const imageUrls = await getImageFromZolV2(product.source_url);

        for (const url of imageUrls) {
          imageData = await downloadImageWithReferer(url, product.source_url);
          if (imageData) break;
        }
      }

      // 方法2: 从 pconline 详情页抓取
      if (!imageData && product.source_url && product.source_url.includes('pconline')) {
        const response = await fetch(product.source_url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const html = await response.text();
          const match = html.match(/src="(\/\/img[^"]*_m\.jpg)"/);
          if (match) {
            const url = 'https:' + match[1];
            imageData = await downloadImageWithReferer(url, product.source_url);
          }
        }
      }

      if (imageData) {
        await client.query(
          'UPDATE images SET image_data = $1, mime_type = $2 WHERE id = $3',
          [imageData.buffer, imageData.mimeType, product.image_id]
        );
        console.log(`✅ ${(imageData.buffer.length / 1024).toFixed(1)} KB`);
        fixed++;
      } else {
        console.log('❌ 失败');
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
