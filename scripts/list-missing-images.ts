/**
 * 列出没有图片的产品及其 JSON 文件位置
 */

import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
  max: 10,
});

const productsDir = 'C:\\Users\\20264\\Desktop\\My\\crawler\\da\\products';

async function findJsonFile(brand: string, productId: number): Promise<string | null> {
  const brandDir = path.join(productsDir, brand);

  if (!fs.existsSync(brandDir)) return null;

  const files = fs.readdirSync(brandDir);

  for (const file of files) {
    if (file.endsWith('_all.json')) continue;

    try {
      const filePath = path.join(brandDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.product_id && parseInt(data.product_id) === productId) {
        return filePath;
      }
    } catch {
      // 跳过解析失败的文件
    }
  }

  return null;
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔍 查找没有图片的产品...\n');

    // 查找没有 image_id 或 image_id 对应的图片不存在的产品
    const result = await client.query(`
      SELECT p.id, p.name, p.brand, p.model, p.images, p.image_id, p.source_url
      FROM products p
      WHERE p.image_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
      ORDER BY p.brand, p.id
    `);

    console.log(`📊 找到 ${result.rows.length} 个产品没有有效图片\n`);

    const missingList: Array<{
      id: number;
      name: string;
      brand: string;
      model: string;
      imageUrl: string | null;
      jsonPath: string | null;
    }> = [];

    for (const product of result.rows) {
      const imageUrl = product.images && product.images.length > 0 ? product.images[0] : null;
      const jsonPath = await findJsonFile(product.brand, product.id);

      missingList.push({
        id: product.id,
        name: product.name,
        brand: product.brand,
        model: product.model,
        imageUrl,
        jsonPath,
      });
    }

    // 按品牌分组显示
    const groupedByBrand: Record<string, typeof missingList> = {};
    for (const item of missingList) {
      if (!groupedByBrand[item.brand]) {
        groupedByBrand[item.brand] = [];
      }
      groupedByBrand[item.brand].push(item);
    }

    for (const [brand, items] of Object.entries(groupedByBrand)) {
      console.log(`\n📦 ${brand} (${items.length} 条):`);
      for (const item of items) {
        console.log(`  - [${item.id}] ${item.name || item.model || '(无名称)'}`);
        if (item.jsonPath) {
          console.log(`    📁 ${item.jsonPath}`);
        } else {
          console.log(`    ⚠️ 未找到 JSON 文件`);
        }
        if (item.imageUrl) {
          console.log(`    🖼️ ${item.imageUrl}`);
        } else {
          console.log(`    ❌ 无图片URL`);
        }
      }
    }

    // 统计
    const withJson = missingList.filter(item => item.jsonPath).length;
    const withUrl = missingList.filter(item => item.imageUrl).length;
    const noJson = missingList.filter(item => !item.jsonPath).length;
    const noUrl = missingList.filter(item => !item.imageUrl).length;

    console.log('\n\n📊 统计汇总:');
    console.log(`  - 总计: ${missingList.length} 条`);
    console.log(`  - 有JSON文件: ${withJson} 条`);
    console.log(`  - 无JSON文件: ${noJson} 条`);
    console.log(`  - 有图片URL: ${withUrl} 条`);
    console.log(`  - 无图片URL: ${noUrl} 条`);

  } catch (error) {
    console.error('❌ 查询失败:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
