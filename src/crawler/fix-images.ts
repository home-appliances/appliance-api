/**
 * 修复产品图片脚本
 * 从产品图片页面获取正确的图片
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { PconlineClient } from './pconline-client';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

// 从产品图片页面提取图片
const extractImagesFromPicturePage = (html: string): string[] => {
  const images: string[] = [];
  const seenUrls = new Set<string>();

  // 匹配产品图片页面的图片
  // 格式: "//img4.pconline.com.cn/pconline/images/product/xxx.jpg"
  const regex = /"(\/\/img4\.pconline\.com\.cn\/pconline\/images\/product\/[^"]*\.(jpg|jpeg|png|webp))"/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    let url = match[1];

    // 补全协议
    if (url.startsWith('//')) {
      url = 'https:' + url;
    }

    // 去重
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      images.push(url);
    }
  }

  return images;
};

async function fixImages() {
  console.log('🔧 开始修复产品图片...\n');

  const client = new PconlineClient();

  // 获取所有产品
  const products = await pool.query('SELECT id, name, brand, source_url FROM products ORDER BY id');
  console.log(`📦 共 ${products.rows.length} 个产品\n`);

  let fixedCount = 0;
  let failedCount = 0;

  for (const product of products.rows) {
    try {
      // 从 source_url 提取品牌和产品 ID
      const match = product.source_url.match(/\/icebox\/(\w+)\/(\d+)\.html/);
      if (!match) {
        console.log(`❌ [${product.id}] ${product.name}: 无法解析 source_url`);
        failedCount++;
        continue;
      }

      const brand = match[1];
      const productId = match[2];

      // 爬取产品图片页面
      const html = await client.fetchWithRetry(
        `https://product.pconline.com.cn/pdlib/${productId}_picture.html`
      );

      // 提取产品图片
      const productImages = extractImagesFromPicturePage(html);

      // 更新数据库
      if (productImages.length > 0) {
        await pool.query(
          'UPDATE products SET images = $1 WHERE id = $2',
          [productImages, product.id]
        );
        console.log(`✅ [${product.id}] ${product.name}: ${productImages.length} 张图片`);
        fixedCount++;
      } else {
        console.log(`⚠️ [${product.id}] ${product.name}: 未找到产品图片`);
        failedCount++;
      }

      // 延迟，避免请求过快
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      console.log(`❌ [${product.id}] ${product.name}: ${(error as Error).message}`);
      failedCount++;
    }
  }

  console.log(`\n📊 修复完成:`);
  console.log(`  - 成功: ${fixedCount} 个`);
  console.log(`  - 失败: ${failedCount} 个`);

  await pool.end();
}

fixImages().catch(console.error);
