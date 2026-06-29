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
  // 检查图片数据质量
  const stats = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN mime_type = 'image/jpeg' THEN 1 END) as jpeg,
      COUNT(CASE WHEN mime_type = 'image/png' THEN 1 END) as png,
      COUNT(CASE WHEN mime_type = 'image/gif' THEN 1 END) as gif,
      COUNT(CASE WHEN mime_type = 'image/webp' THEN 1 END) as webp,
      COUNT(CASE WHEN mime_type NOT LIKE 'image/%' THEN 1 END) as other,
      COUNT(CASE WHEN octet_length(image_data) < 1024 THEN 1 END) as small,
      COUNT(CASE WHEN octet_length(image_data) > 500000 THEN 1 END) as large
    FROM images
  `);

  const s = stats.rows[0];
  console.log('📊 图片数据统计:');
  console.log('  总数:', s.total);
  console.log('  JPEG:', s.jpeg);
  console.log('  PNG:', s.png);
  console.log('  GIF:', s.gif);
  console.log('  WebP:', s.webp);
  console.log('  其他格式:', s.other);
  console.log('  小于1KB:', s.small);
  console.log('  大于500KB:', s.large);

  // 检查有问题的图片
  console.log('\n⚠️ 可能有问题的图片:');

  // 非标准格式
  const otherFormat = await pool.query(`
    SELECT id, mime_type, octet_length(image_data) as size
    FROM images
    WHERE mime_type NOT LIKE 'image/%'
    LIMIT 10
  `);

  if (otherFormat.rows.length > 0) {
    console.log('\n非标准格式:');
    for (const img of otherFormat.rows) {
      console.log(`  ID: ${img.id}, MIME: ${img.mime_type}, 大小: ${img.size} bytes`);
    }
  }

  // 特别小的图片
  const smallImages = await pool.query(`
    SELECT id, mime_type, octet_length(image_data) as size
    FROM images
    WHERE octet_length(image_data) < 1024
    LIMIT 10
  `);

  if (smallImages.rows.length > 0) {
    console.log('\n小于1KB的图片:');
    for (const img of smallImages.rows) {
      console.log(`  ID: ${img.id}, MIME: ${img.mime_type}, 大小: ${img.size} bytes`);
    }
  }

  await pool.end();
}
main();
