/**
 * 检查数据库数据
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

async function checkData() {
  try {
    console.log('📊 检查数据库数据...\n');

    // 统计产品数量
    const productCount = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log('📦 产品总数:', productCount.rows[0].count);

    // 统计图片数量
    const imageCount = await pool.query('SELECT COUNT(*) as count FROM images');
    console.log('🖼️ 图片总数:', imageCount.rows[0].count);

    // 按品牌统计
    const brandStats = await pool.query(`
      SELECT brand, COUNT(*) as count
      FROM products
      GROUP BY brand
      ORDER BY count DESC
    `);
    console.log('\n📈 品牌统计:');
    brandStats.rows.forEach((row: any) => {
      console.log(`  - ${row.brand}: ${row.count} 个产品`);
    });

    // 查看最新爬取的产品
    const latestProducts = await pool.query(`
      SELECT id, name, brand, model, source_url, created_at
      FROM products
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log('\n🆕 最新爬取的产品:');
    latestProducts.rows.forEach((row: any) => {
      console.log(`  - [${row.brand}] ${row.name}`);
      console.log(`    ID: ${row.id}, 型号: ${row.model || '无'}`);
      console.log(`    来源: ${row.source_url}`);
    });

    // 查看一个产品的完整参数
    const sampleProduct = await pool.query(`
      SELECT * FROM products
      WHERE params != '{}'::jsonb
      LIMIT 1
    `);

    if (sampleProduct.rows.length > 0) {
      const product = sampleProduct.rows[0] as any;
      console.log('\n📋 产品参数示例:');
      console.log(`  名称: ${product.name}`);
      console.log(`  品牌: ${product.brand}`);
      console.log(`  型号: ${product.model || '无'}`);
      console.log(`  价格: ${product.price || '无'}`);
      console.log(`  评分: ${product.rating || '无'}`);
      console.log('  参数:');
      const params = product.params;
      Object.entries(params).slice(0, 8).forEach(([key, value]) => {
        console.log(`    - ${key}: ${value}`);
      });
      if (Object.keys(params).length > 8) {
        console.log(`    ... 还有 ${Object.keys(params).length - 8} 个参数`);
      }
    }

    // 查看图片示例
    const sampleImage = await pool.query(`
      SELECT id, mime_type, file_size, width, height, source_url
      FROM images
      LIMIT 3
    `);

    if (sampleImage.rows.length > 0) {
      console.log('\n🖼️ 图片示例:');
      sampleImage.rows.forEach((row: any) => {
        console.log(`  - ID: ${row.id}`);
        console.log(`    类型: ${row.mime_type}`);
        console.log(`    大小: ${(row.file_size / 1024).toFixed(1)} KB`);
        console.log(`    尺寸: ${row.width || '未知'} x ${row.height || '未知'}`);
        console.log(`    来源: ${row.source_url?.substring(0, 50)}...`);
      });
    }

    await pool.end();
    console.log('\n✅ 数据检查完成!');
  } catch (error) {
    console.error('❌ 检查失败:', error);
  }
}

checkData();
