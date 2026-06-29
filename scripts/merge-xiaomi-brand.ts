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
  console.log('🔄 合并 mijia 品牌到 xiaomi...\n');

  // 更新品牌字段
  const result = await pool.query(`
    UPDATE products
    SET brand = 'xiaomi'
    WHERE brand = 'mijia'
    RETURNING id
  `);

  console.log(`✅ 已更新 ${result.rowCount} 条产品\n`);

  // 更新拼音字段
  await pool.query(`
    UPDATE products
    SET pinyin = REPLACE(pinyin, 'mijia', 'xiaomi'),
        pinyin_initials = REPLACE(pinyin_initials, 'mj', 'xm')
    WHERE brand = 'xiaomi' AND (pinyin LIKE '%mijia%' OR pinyin_initials LIKE '%mj%')
  `);

  console.log('✅ 已更新拼音字段\n');

  // 验证结果
  const stats = await pool.query(`
    SELECT brand, COUNT(*) as count
    FROM products
    WHERE brand = 'xiaomi'
    GROUP BY brand
  `);

  console.log('📊 合并后的小米产品统计:');
  for (const row of stats.rows) {
    console.log(`  - ${row.brand}: ${row.count} 条`);
  }

  // 检查产品名称分布
  const nameStats = await pool.query(`
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

  console.log('\n产品名称分布:');
  for (const row of nameStats.rows) {
    console.log(`  - ${row.name_type}: ${row.count} 条`);
  }

  await pool.end();
}
main();
