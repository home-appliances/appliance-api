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

async function searchProducts(keyword: string) {
  const result = await pool.query(`
    SELECT id, name, brand, model
    FROM products
    WHERE brand ILIKE $1
       OR name ILIKE $2
       OR model ILIKE $2
    LIMIT 5
  `, [`%${keyword}%`, `%${keyword}%`]);

  return result.rows;
}

async function main() {
  console.log('🔍 测试搜索功能:\n');

  // 测试1: 搜索子品牌名称
  const tests = ['卡萨帝', '统帅', 'COLMO', '华凌', '海尔', '美的', '三菱', '小米', '米家'];

  for (const keyword of tests) {
    const results = await searchProducts(keyword);
    console.log(`搜索 "${keyword}": ${results.length} 条结果`);
    for (const p of results.slice(0, 3)) {
      console.log(`  - [${p.id}] ${p.brand} | ${p.name}`);
    }
    console.log('');
  }

  await pool.end();
}
main();
