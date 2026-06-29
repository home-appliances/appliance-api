/**
 * 数据库迁移脚本：添加 images_binary 字段
 * 用于存储图片二进制数据
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔄 开始数据库迁移...\n');

    // 1. 检查字段是否已存在
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'images_binary'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ images_binary 字段已存在，跳过迁移');
      return;
    }

    // 2. 添加新字段
    console.log('📝 添加 images_binary 字段...');
    await client.query(`
      ALTER TABLE products
      ADD COLUMN images_binary bytea[]
    `);
    console.log('✅ 字段添加成功\n');

    // 3. 创建索引（可选，加速查询）
    // 注意：bytea 数组不支持直接索引，但可以创建 GIN 索引

    console.log('🎉 迁移完成！');
    console.log('下一步：运行 npm run import:images 导入图片二进制数据');

  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
