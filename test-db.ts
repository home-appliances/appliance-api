/**
 * 数据库连接测试
 */

import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres123',
});

async function test() {
  try {
    console.log('🔗 测试数据库连接...');
    const result = await pool.query('SELECT 1 as test');
    console.log('✅ 数据库连接成功:', result.rows);

    // 创建数据库
    try {
      await pool.query('CREATE DATABASE appliance_db');
      console.log('✅ 数据库 appliance_db 创建成功');
    } catch (e) {
      console.log('⚠️ 数据库可能已存在');
    }

    await pool.end();
    console.log('\n🎉 数据库测试完成!');
  } catch (error) {
    console.error('❌ 连接失败:', error);
  }
}

test();
