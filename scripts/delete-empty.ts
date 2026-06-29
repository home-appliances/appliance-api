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

async function main() {
  // 删除空记录
  const result = await pool.query('DELETE FROM products WHERE id = 73323 RETURNING id');
  console.log('删除结果:', result.rowCount, '条');

  // 统计
  const total = await pool.query('SELECT COUNT(*) FROM products');
  const withImage = await pool.query(`
    SELECT COUNT(*) FROM products p
    WHERE EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
  `);

  console.log('\n📊 最终统计:');
  console.log('  产品总数:', total.rows[0].count);
  console.log('  有图片产品:', withImage.rows[0].count);
  console.log('  图片覆盖率:', ((parseInt(withImage.rows[0].count) / parseInt(total.rows[0].count)) * 100).toFixed(2) + '%');

  await pool.end();
}
main();
