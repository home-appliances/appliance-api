/**
 * 更新管理员密码
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

async function updatePassword() {
  console.log('连接数据库...');
  const client = await pool.connect();

  try {
    const username = 'admin';
    const password = 'admin123';

    console.log(`更新用户 ${username} 的密码...`);

    // 生成密码哈希
    const passwordHash = await bcrypt.hash(password, 10);

    // 更新数据库
    const result = await client.query(
      'UPDATE admins SET password_hash = $1 WHERE username = $2 RETURNING id, username',
      [passwordHash, username]
    );

    if (result.rows.length === 0) {
      // 如果用户不存在，创建一个
      console.log('用户不存在，创建新用户...');
      await client.query(
        'INSERT INTO admins (username, password_hash) VALUES ($1, $2)',
        [username, passwordHash]
      );
      console.log('✅ 用户创建成功');
    } else {
      console.log('✅ 密码更新成功');
    }

    console.log('');
    console.log('登录信息：');
    console.log('  用户名: admin');
    console.log('  密码: admin123');
  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updatePassword();
