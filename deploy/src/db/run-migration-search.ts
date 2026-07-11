/**
 * 执行搜索优化迁移脚本
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

    const migrationPath = path.join(__dirname, 'migration-search.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('执行搜索优化迁移...');
    await pool.query(migrationSQL);
    console.log('迁移完成');

    // 验证
    const logsTable = await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'search_logs'
    `);
    console.log('search_logs 表:', logsTable.rows.length > 0 ? '已创建' : '未找到');

    const pinyinCol = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'pinyin'
    `);
    console.log('pinyin 列:', pinyinCol.rows.length > 0 ? '已添加' : '未找到');

  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
