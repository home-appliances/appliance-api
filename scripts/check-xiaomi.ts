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
  // 查询小米产品数量
  const countResult = await pool.query(`
    SELECT COUNT(*) as count FROM products WHERE brand = 'xiaomi'
  `);

  console.log(`小米产品总数: ${countResult.rows[0].count} 条\n`);

  // 查询小米产品详情
  const result = await pool.query(`
    SELECT p.id, p.name, p.model, p.category,
           CASE WHEN EXISTS (SELECT 1 FROM images WHERE id = p.image_id AND octet_length(image_data) >= 5120) THEN '✅ 正常' ELSE '⚠️ 小图' END as image_status
    FROM products p
    WHERE p.brand = 'xiaomi'
    ORDER BY p.id
  `);

  console.log('小米产品列表:\n');
  console.log('ID | 型号 | 名称 | 分类 | 图片状态');
  console.log('--|------|------|------|----------');

  for (const p of result.rows) {
    console.log(`${p.id} | ${p.model} | ${p.name} | ${p.category} | ${p.image_status}`);
  }

  await pool.end();
}
main();
