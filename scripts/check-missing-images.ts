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
  // 检查是否有产品没有 image_id
  const noImageId = await pool.query(`
    SELECT COUNT(*) as count FROM products WHERE image_id IS NULL
  `);

  console.log('没有 image_id 的产品:', noImageId.rows[0].count);

  // 检查是否有 image_id 指向不存在的图片
  const orphanImage = await pool.query(`
    SELECT COUNT(*) as count FROM products p
    WHERE p.image_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
  `);

  console.log('image_id 指向不存在图片的产品:', orphanImage.rows[0].count);

  // 检查图片数据是否为空
  const emptyImage = await pool.query(`
    SELECT COUNT(*) as count FROM images WHERE image_data IS NULL OR octet_length(image_data) = 0
  `);

  console.log('图片数据为空的记录:', emptyImage.rows[0].count);

  // 列出有问题的产品
  if (parseInt(noImageId.rows[0].count) > 0) {
    console.log('\n没有 image_id 的产品:');
    const products = await pool.query(`
      SELECT id, name, brand FROM products WHERE image_id IS NULL LIMIT 10
    `);
    for (const p of products.rows) {
      console.log(`  [${p.id}] ${p.brand} ${p.name}`);
    }
  }

  await pool.end();
}
main();
