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
  const keyword = '小米空调';
  const searchTerms = ['小米', '空调'];

  // 测试分词匹配
  const term1 = '%小米%';
  const term2 = '%空调%';

  console.log('测试搜索:', keyword);
  console.log('分词:', searchTerms);
  console.log('');

  // 测试查询
  const result = await pool.query(`
    SELECT id, name, brand, category
    FROM products
    WHERE (name ILIKE $1 OR brand ILIKE $1 OR name ILIKE $2 OR brand ILIKE $2)
    ORDER BY
      CASE WHEN brand = 'xiaomi' THEN 0 ELSE 1 END,
      CASE WHEN name ILIKE '%小米%' THEN 0 ELSE 1 END,
      CASE WHEN name ILIKE '%空调%' THEN 0 ELSE 1 END,
      id
    LIMIT 10
  `, [term1, term2]);

  console.log('搜索结果:');
  for (const row of result.rows) {
    console.log(`  [${row.id}] ${row.brand} - ${row.name}`);
    console.log(`    品牌分: ${row.brand_score}, 类别分: ${row.category_score}, 词匹配: ${row.term_count}`);
  }

  await pool.end();
}
main();
