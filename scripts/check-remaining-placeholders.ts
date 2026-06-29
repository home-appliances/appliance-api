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
  // 查找仍然使用占位图的产品
  const result = await pool.query(`
    SELECT p.id, p.brand, p.model, p.name, p.images, p.source_url,
           i.mime_type, octet_length(i.image_data) as image_bytes
    FROM products p
    LEFT JOIN images i ON p.image_id = i.id
    WHERE p.images[1] LIKE '%default_logo%'
       OR p.images[1] LIKE '%default%'
       OR p.images[1] LIKE '%placeholder%'
       OR (i.image_data IS NOT NULL AND octet_length(i.image_data) < 5120)
    ORDER BY p.brand, p.id
    LIMIT 50
  `);

  console.log('仍然使用占位图的产品 (前50个):\n');

  const brandStats: Record<string, number> = {};
  const allResult = await pool.query(`
    SELECT COUNT(*) as count, p.brand
    FROM products p
    LEFT JOIN images i ON p.image_id = i.id
    WHERE p.images[1] LIKE '%default_logo%'
       OR p.images[1] LIKE '%default%'
       OR p.images[1] LIKE '%placeholder%'
       OR (i.image_data IS NOT NULL AND octet_length(i.image_data) < 5120)
    GROUP BY p.brand
    ORDER BY count DESC
  `);

  console.log('各品牌剩余占位图数量:');
  for (const row of allResult.rows) {
    console.log(`  - ${row.brand}: ${row.count} 个`);
  }

  console.log('\n示例产品:');
  for (const p of result.rows.slice(0, 20)) {
    const imgSize = p.image_bytes ? `${(p.image_bytes / 1024).toFixed(1)} KB` : '无';
    console.log(`  [${p.id}] ${p.brand} ${p.model || p.name}`);
    console.log(`    图片: ${imgSize}, 详情页: ${p.source_url ? '有' : '无'}`);
  }

  await pool.end();
}
main();
