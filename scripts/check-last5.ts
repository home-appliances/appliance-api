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
  const result = await pool.query(`
    SELECT p.id, p.brand, p.model, p.name, p.source_url, p.images,
           octet_length(i.image_data) as image_bytes
    FROM products p
    JOIN images i ON p.image_id = i.id
    WHERE octet_length(i.image_data) < 5120
    ORDER BY p.id
  `);

  console.log(`最后 ${result.rows.length} 张小图:\n`);

  for (const p of result.rows) {
    console.log(`ID: ${p.id}`);
    console.log(`品牌: ${p.brand}`);
    console.log(`型号: ${p.model}`);
    console.log(`名称: ${p.name}`);
    console.log(`详情页: ${p.source_url}`);
    console.log(`原始图片: ${p.images[0]}`);
    console.log(`当前大小: ${(p.image_bytes / 1024).toFixed(1)} KB`);
    console.log('---');
  }

  await pool.end();
}
main();
