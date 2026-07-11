/**
 * 数据库优化迁移脚本
 * 运行: npx tsx src/db/run-optimize.ts
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 开始数据库优化迁移...\n');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'migration-optimize.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // 执行 SQL
    console.log('📦 执行优化脚本...');
    await client.query(sql);

    console.log('✅ 迁移完成！\n');

    // 验证结果
    console.log('📊 验证数据：');

    const categoriesResult = await client.query('SELECT COUNT(*) FROM categories');
    console.log(`   分类数量: ${categoriesResult.rows[0].count}`);

    const productsResult = await client.query('SELECT COUNT(*) FROM products');
    console.log(`   产品数量: ${productsResult.rows[0].count}`);

    const imagesResult = await client.query('SELECT COUNT(*) FROM images');
    console.log(`   图片数量: ${imagesResult.rows[0].count}`);

    const searchLogsResult = await client.query('SELECT COUNT(*) FROM search_logs');
    console.log(`   搜索日志: ${searchLogsResult.rows[0].count}`);

    // 检查 category_id 回填情况
    const categoryFilled = await client.query(
      'SELECT COUNT(*) FROM products WHERE category_id IS NOT NULL'
    );
    const categoryTotal = await client.query('SELECT COUNT(*) FROM products');
    console.log(`   分类关联: ${categoryFilled.rows[0].count}/${categoryTotal.rows[0].count} 产品已关联分类`);

    console.log('\n✨ 优化迁移成功完成！');
    console.log('\n📋 后续步骤：');
    console.log('   1. 更新代码使用 category_id 替代 category 字段');
    console.log('   2. 更新代码统一使用 image_id 获取图片');
    console.log('   3. 测试搜索功能是否正常');
    console.log('   4. 确认无误后可删除 products.images 字段');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((error) => {
  console.error('迁移失败:', error);
  process.exit(1);
});
