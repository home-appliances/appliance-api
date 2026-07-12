/**
 * 执行管理后台数据库迁移
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

async function runMigration() {
  console.log('连接数据库...');
  const client = await pool.connect();

  try {
    console.log('执行管理后台迁移脚本...');

    const sqlPath = path.join(__dirname, 'admin-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await client.query(sql);

    console.log('✅ 管理后台迁移完成！');
    console.log('');
    console.log('默认管理员账号：');
    console.log('  用户名: admin');
    console.log('  密码: admin123');
    console.log('');
    console.log('⚠️  请登录后立即修改密码！');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
