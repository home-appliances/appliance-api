/**
 * 初始化数据库表结构
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'appliance_db',
  user: 'postgres',
  password: 'postgres123',
});

async function initDatabase() {
  try {
    console.log('🔗 连接数据库 appliance_db...');
    await pool.query('SELECT 1');
    console.log('✅ 数据库连接成功');

    // 读取 SQL 文件
    const sqlPath = path.join(__dirname, 'src/db/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('📝 执行 SQL 初始化...');
    await pool.query(sql);
    console.log('✅ 表结构创建成功');

    // 验证表
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('\n📊 已创建的表:');
    tables.rows.forEach(row => console.log(`  - ${row.table_name}`));

    await pool.end();
    console.log('\n🎉 数据库初始化完成!');
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    await pool.end();
  }
}

initDatabase();
