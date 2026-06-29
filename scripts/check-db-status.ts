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
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN EXISTS (SELECT 1 FROM images WHERE id = p.image_id AND octet_length(image_data) >= 5120) THEN 1 END) as good,
      COUNT(CASE WHEN EXISTS (SELECT 1 FROM images WHERE id = p.image_id AND octet_length(image_data) < 5120) THEN 1 END) as small,
      COUNT(CASE WHEN p.image_id IS NULL THEN 1 END) as no_image
    FROM products p
  `);

  const s = stats.rows[0];
  console.log('📊 数据库当前状态:');
  console.log('  产品总数:', s.total);
  console.log('  正常图片 (≥5KB):', s.good);
  console.log('  小图 (<5KB):', s.small);
  console.log('  无图片:', s.no_image);
  console.log('  图片覆盖率:', ((parseInt(s.good) / parseInt(s.total)) * 100).toFixed(2) + '%');

  await pool.end();
}
main();
