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
  // 检查数据库中的品牌字段
  const brandResult = await pool.query(`
    SELECT DISTINCT brand, COUNT(*) as count
    FROM products
    WHERE brand LIKE '%xiaomi%' OR brand LIKE '%mi%' OR brand LIKE '%小米%' OR brand LIKE '%米家%'
    GROUP BY brand
    ORDER BY count DESC
  `);

  console.log('数据库中包含"小米/米家/xiaomi"的品牌:\n');
  for (const row of brandResult.rows) {
    console.log(`  - ${row.brand}: ${row.count} 条`);
  }

  // 检查产品名称中包含"米家"的产品
  const mijiaResult = await pool.query(`
    SELECT COUNT(*) as count FROM products WHERE name LIKE '%米家%'
  `);

  console.log(`\n产品名称包含"米家"的产品: ${mijiaResult.rows[0].count} 条`);

  // 检查品牌为 xiaomi 的产品名称分布
  const nameResult = await pool.query(`
    SELECT
      CASE
        WHEN name LIKE '%米家%' THEN '米家'
        WHEN name LIKE '%小米%' THEN '小米'
        ELSE '其他'
      END as name_type,
      COUNT(*) as count
    FROM products
    WHERE brand = 'xiaomi'
    GROUP BY name_type
  `);

  console.log('\n品牌为 xiaomi 的产品名称分布:');
  for (const row of nameResult.rows) {
    console.log(`  - ${row.name_type}: ${row.count} 条`);
  }

  await pool.end();
}
main();
