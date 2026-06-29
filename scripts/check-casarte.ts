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
  // 检查卡萨帝产品
  const result = await pool.query(`
    SELECT id, name, brand, category
    FROM products
    WHERE name LIKE '%卡萨帝%' OR brand = 'casarte'
    LIMIT 10
  `);

  console.log('卡萨帝产品:');
  for (const p of result.rows) {
    console.log(`  [${p.id}] ${p.brand} - ${p.name} (${p.category})`);
  }

  // 检查 haier 品牌中名称包含"卡萨帝"的产品
  const haierResult = await pool.query(`
    SELECT COUNT(*) as count FROM products WHERE brand = 'haier' AND name LIKE '%卡萨帝%'
  `);
  console.log('\nhaier品牌中名称包含"卡萨帝"的产品数量:', haierResult.rows[0].count);

  await pool.end();
}
main();
