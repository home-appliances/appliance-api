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
  // 查看修复的图片大小
  const result = await pool.query(`
    SELECT p.id, p.brand, p.model, p.images,
           octet_length(i.image_data) as image_bytes
    FROM products p
    JOIN images i ON p.image_id = i.id
    WHERE p.id IN (
      74689, 74902, 74903, 74904, 74905, 74906, 74907, 74908, 74909, 74910,
      74911, 74912, 74913, 74914, 74915, 74916, 74917, 74918, 74919, 74920,
      74921, 74922, 76493, 76510, 77168, 77169, 77170, 77171, 77172, 77173,
      77174, 77175, 77281, 77282, 78957, 79648, 79649, 79654, 80217, 80629,
      80752, 80753, 80754, 80827, 80838, 81960
    )
    ORDER BY p.id
  `);

  console.log('修复图片的来源URL和大小:\n');

  let smallCount = 0;
  let mediumCount = 0;
  let largeCount = 0;

  for (const p of result.rows) {
    const sizeKB = p.image_bytes / 1024;
    const originalUrl = p.images && p.images.length > 0 ? p.images[0] : '无';

    let sizeType = '';
    if (sizeKB < 20) {
      sizeType = '⚠️ 小图';
      smallCount++;
    } else if (sizeKB < 100) {
      sizeType = '中图';
      mediumCount++;
    } else {
      sizeType = '✅ 大图';
      largeCount++;
    }

    console.log(`[${p.id}] ${p.brand} ${p.model}`);
    console.log(`  原始URL: ${originalUrl}`);
    console.log(`  大小: ${sizeKB.toFixed(1)} KB ${sizeType}`);
    console.log('');
  }

  console.log('📊 图片大小统计:');
  console.log(`  - 小图 (<20KB): ${smallCount} 张`);
  console.log(`  - 中图 (20-100KB): ${mediumCount} 张`);
  console.log(`  - 大图 (>100KB): ${largeCount} 张`);

  await pool.end();
}
main();
