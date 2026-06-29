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
  // 检查品牌分布
  const brands = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    GROUP BY brand
    ORDER BY count DESC
    LIMIT 20
  `);

  console.log('品牌分布 (前20):\n');
  for (const row of brands.rows) {
    console.log(`  ${row.brand}: ${row.count} 条`);
  }

  // 检查小米产品
  const xiaomi = await pool.query(`
    SELECT id, name, brand, category
    FROM products
    WHERE brand = 'xiaomi'
    LIMIT 5
  `);

  console.log('\n小米产品示例:');
  for (const p of xiaomi.rows) {
    console.log(`  [${p.id}] ${p.brand} - ${p.name} (${p.category})`);
  }

  // 检查空调产品
  const aircon = await pool.query(`
    SELECT COUNT(*) as count FROM products WHERE category = 'air_condition'
  `);
  console.log('\n空调产品数量:', aircon.rows[0].count);

  await pool.end();
}
main();
