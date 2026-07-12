/**
 * 检查没有图片的产品
 * 运行: npx tsx src/db/check-no-image.ts
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

async function main() {
  console.log('🔍 检查没有图片的产品\n');

  // 1. 统计总数
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(image_id) as with_image,
      COUNT(*) - COUNT(image_id) as without_image
    FROM products
  `);

  const { total, with_image, without_image } = stats.rows[0];
  console.log('📊 总体统计:');
  console.log(`   总产品数: ${total}`);
  console.log(`   有图片: ${with_image}`);
  console.log(`   无图片: ${without_image}`);
  console.log('');

  // 2. 获取没有图片的产品
  const noImageProducts = await pool.query(`
    SELECT id, name, brand, model, category, source_url
    FROM products
    WHERE image_id IS NULL
    ORDER BY brand, name
    LIMIT 100
  `);

  console.log(`📋 无图片产品列表 (前 100 个):`);
  console.log('='.repeat(80));

  // 按品牌分组
  const byBrand: Record<string, any[]> = {};
  for (const p of noImageProducts.rows) {
    if (!byBrand[p.brand]) byBrand[p.brand] = [];
    byBrand[p.brand].push(p);
  }

  for (const [brand, products] of Object.entries(byBrand)) {
    console.log(`\n🏷️  ${brand} (${products.length} 个):`);
    for (const p of products) {
      console.log(`   - ${p.name} (${p.model})`);
      console.log(`     ID: ${p.id}, 分类: ${p.category}`);
      if (p.source_url) {
        console.log(`     来源: ${p.source_url}`);
      }
    }
  }

  // 3. 按品牌统计无图片产品
  const brandStats = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    WHERE image_id IS NULL
    GROUP BY brand
    ORDER BY count DESC
  `);

  console.log('\n\n📈 按品牌统计无图片产品:');
  console.log('='.repeat(40));
  for (const row of brandStats.rows) {
    console.log(`   ${row.brand}: ${row.count} 个`);
  }

  // 4. 检查这些产品的原始数据
  console.log('\n\n🔎 检查原始数据 (前 5 个):');
  console.log('='.repeat(80));

  const sampleProducts = await pool.query(`
    SELECT id, name, source_url
    FROM products
    WHERE image_id IS NULL
    LIMIT 5
  `);

  for (const p of sampleProducts.rows) {
    console.log(`\n产品: ${p.name}`);
    console.log(`ID: ${p.id}`);
    console.log(`来源 URL: ${p.source_url || '无'}`);
  }

  await pool.end();
  console.log('\n✨ 检查完成！');
}

main().catch(console.error);
