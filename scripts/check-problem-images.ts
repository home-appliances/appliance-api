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
  console.log('🔍 检查可能有问题的图片...\n');

  // 1. 检查 image_id 指向不存在的图片
  const orphanResult = await pool.query(`
    SELECT COUNT(*) as count FROM products p
    WHERE p.image_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
  `);
  console.log('image_id 指向不存在图片的产品:', orphanResult.rows[0].count);

  // 2. 检查没有 image_id 的产品
  const noImageId = await pool.query(`
    SELECT COUNT(*) as count FROM products WHERE image_id IS NULL
  `);
  console.log('没有 image_id 的产品:', noImageId.rows[0].count);

  // 3. 检查图片数据为空的记录
  const emptyData = await pool.query(`
    SELECT COUNT(*) as count FROM images WHERE image_data IS NULL OR octet_length(image_data) = 0
  `);
  console.log('图片数据为空的记录:', emptyData.rows[0].count);

  // 4. 检查 MIME 类型问题
  const mimeResult = await pool.query(`
    SELECT mime_type, COUNT(*) as count
    FROM images
    GROUP BY mime_type
    ORDER BY count DESC
  `);
  console.log('\n图片格式分布:');
  for (const row of mimeResult.rows) {
    console.log(`  ${row.mime_type}: ${row.count}`);
  }

  // 5. 检查特别大的图片
  const largeResult = await pool.query(`
    SELECT COUNT(*) as count FROM images WHERE octet_length(image_data) > 1000000
  `);
  console.log('\n大于1MB的图片:', largeResult.rows[0].count);

  // 6. 检查特别小的图片
  const smallResult = await pool.query(`
    SELECT COUNT(*) as count FROM images WHERE octet_length(image_data) < 1024
  `);
  console.log('小于1KB的图片:', smallResult.rows[0].count);

  // 7. 测试几个图片接口
  console.log('\n测试图片接口:');
  const testIds = [78125, 78202, 78193, 78201];
  for (const id of testIds) {
    const result = await pool.query(
      'SELECT id, mime_type, octet_length(image_data) as size FROM images WHERE id = $1',
      [id]
    );
    if (result.rows.length > 0) {
      const img = result.rows[0];
      console.log(`  ID ${id}: ${img.mime_type}, ${(img.size / 1024).toFixed(1)} KB ✅`);
    } else {
      console.log(`  ID ${id}: 不存在 ❌`);
    }
  }

  await pool.end();
}
main();
