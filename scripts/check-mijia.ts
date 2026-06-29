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
  // 检查 mijia 品牌的产品
  const result = await pool.query(`
    SELECT id, name, model, brand
    FROM products
    WHERE brand = 'mijia'
    ORDER BY id
    LIMIT 20
  `);

  console.log('品牌为 mijia 的产品 (前20条):\n');
  for (const p of result.rows) {
    console.log(`  [${p.id}] ${p.brand} - ${p.name}`);
  }

  // 检查是否需要合并
  console.log('\n\n是否需要将 mijia 品牌合并到 xiaomi？');
  console.log('米家 (mijia) 是小米旗下的智能家居品牌，应该统一为 xiaomi。');

  await pool.end();
}
main();
