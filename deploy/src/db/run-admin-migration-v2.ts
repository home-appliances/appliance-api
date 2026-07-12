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
    console.log('执行管理后台 v2 迁移脚本...');

    const sqlPath = path.join(__dirname, 'admin-schema-v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await client.query(sql);

    console.log('✅ 管理后台 v2 迁移完成！');
    console.log('');
    console.log('新增功能：');
    console.log('  - admins 表扩展（name, email, phone, role, status, avatar, remark）');
    console.log('  - operation_logs 操作日志表');
    console.log('  - system_settings 系统设置表');
    console.log('  - products 表软删除支持（deleted_at, deleted_by）');
    console.log('');
    console.log('默认管理员：admin / admin123');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
