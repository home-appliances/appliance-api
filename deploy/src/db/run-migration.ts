/**
 * 执行全文搜索迁移脚本
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'appliance_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
  });

  try {
    console.log('连接数据库...');
    await pool.query('SELECT 1');
    console.log('数据库连接成功');

    // 读取迁移脚本
    const migrationPath = path.join(__dirname, 'migration-fulltext.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('执行迁移脚本...');
    await pool.query(migrationSQL);
    console.log('迁移完成');

    // 验证索引
    const indexCheck = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'products' AND indexname LIKE '%search_vector%'
    `);
    console.log('搜索索引:', indexCheck.rows);

    // 验证触发器
    const triggerCheck = await pool.query(`
      SELECT trigger_name, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_table = 'products' AND trigger_name LIKE '%tsvector%'
    `);
    console.log('触发器:', triggerCheck.rows);

    // 测试搜索
    console.log('\n测试搜索 "格力"...');
    const testResult = await pool.query(`
      SELECT id, name, brand,
        ts_rank_cd(search_vector, to_tsquery('simple', '格力')) as rank
      FROM products
      WHERE search_vector @@ to_tsquery('simple', '格力')
      ORDER BY rank DESC
      LIMIT 5
    `);
    console.log('搜索结果:', testResult.rows);

  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
