/**
 * 修复缺少图片的产品
 * 从 main_image 字段下载图片并关联到产品
 *
 * 运行: npx tsx src/db/fix-missing-images.ts
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

const DATA_DIR = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\output';

/**
 * 下载图片
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);

  } catch (error) {
    return null;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🔧 修复缺少图片的产品\n');

  // 1. 获取没有图片的产品
  const noImageProducts = await pool.query(`
    SELECT id, name, source_url
    FROM products
    WHERE image_id IS NULL
    ORDER BY id
  `);

  console.log(`📊 找到 ${noImageProducts.rows.length} 个没有图片的产品\n`);

  if (noImageProducts.rows.length === 0) {
    console.log('✅ 所有产品都有图片');
    await pool.end();
    return;
  }

  // 2. 遍历所有 JSON 文件，找到匹配的产品
  const brands = fs.readdirSync(DATA_DIR);
  let fixed = 0;
  let failed = 0;

  for (const brand of brands) {
    const brandDir = path.join(DATA_DIR, brand);
    if (!fs.statSync(brandDir).isDirectory()) continue;

    const jsonFiles = fs.readdirSync(brandDir).filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = path.join(brandDir, file);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        // 查找匹配的产品
        const product = noImageProducts.rows.find(p =>
          p.source_url === data.detail_url ||
          p.name === data.product_name
        );

        if (!product) continue;

        // 检查是否有 main_image
        const imageUrl = data.main_image || data.image_info?.url;
        if (!imageUrl) {
          console.log(`⚠️  ${product.name}: 没有图片 URL`);
          failed++;
          continue;
        }

        console.log(`\n📦 处理: ${product.name}`);
        console.log(`   图片: ${imageUrl}`);

        // 检查图片是否已存在
        const existing = await pool.query(
          'SELECT id FROM images WHERE source_url = $1',
          [imageUrl]
        );

        let imageId: number;

        if (existing.rows.length > 0) {
          imageId = existing.rows[0].id;
          console.log(`   ✅ 图片已存在，ID: ${imageId}`);
        } else {
          // 下载图片
          const imageBuffer = await downloadImage(imageUrl);
          if (!imageBuffer) {
            console.log(`   ❌ 下载失败`);
            failed++;
            continue;
          }

          // 检测 MIME 类型
          let mimeType = 'image/jpeg';
          if (imageUrl.endsWith('.png')) mimeType = 'image/png';
          else if (imageUrl.endsWith('.gif')) mimeType = 'image/gif';
          else if (imageUrl.endsWith('.webp')) mimeType = 'image/webp';

          // 存入数据库
          const result = await pool.query(`
            INSERT INTO images (image_data, mime_type, file_size, source_url, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id
          `, [imageBuffer, mimeType, imageBuffer.length, imageUrl]);

          imageId = result.rows[0].id;
          console.log(`   ✅ 图片已保存，ID: ${imageId}, 大小: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
        }

        // 关联到产品
        await pool.query(
          'UPDATE products SET image_id = $1 WHERE id = $2',
          [imageId, product.id]
        );
        console.log(`   ✅ 已关联到产品`);
        fixed++;

      } catch (error) {
        // 忽略解析错误
      }
    }
  }

  // 3. 统计结果
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(image_id) as with_image,
      COUNT(*) - COUNT(image_id) as without_image
    FROM products
  `);

  console.log('\n' + '='.repeat(60));
  console.log('📊 修复统计:');
  console.log(`   修复成功: ${fixed}`);
  console.log(`   修复失败: ${failed}`);
  console.log(`\n📋 修复后状态:`);
  console.log(`   总产品数: ${stats.rows[0].total}`);
  console.log(`   有图片: ${stats.rows[0].with_image}`);
  console.log(`   无图片: ${stats.rows[0].without_image}`);
  console.log('='.repeat(60));

  await pool.end();
  console.log('\n✨ 修复完成！');
}

main().catch(console.error);
