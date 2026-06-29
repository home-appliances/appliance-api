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
    SELECT p.id, p.brand, p.model, p.name, p.source_url,
           i.mime_type, octet_length(i.image_data) as image_bytes
    FROM products p
    JOIN images i ON p.image_id = i.id
    WHERE octet_length(i.image_data) < 5120
    ORDER BY p.brand, p.id
  `);

  console.log(`剩余 ${result.rows.length} 张小图:\n`);
  console.log('ID | 品牌 | 型号 | 图片大小 | 详情页');
  console.log('--|------|------|----------|------');

  for (const p of result.rows) {
    const sizeKB = (p.image_bytes / 1024).toFixed(1);
    const hasDetail = p.source_url ? '有' : '无';
    console.log(`${p.id} | ${p.brand} | ${p.model || p.name} | ${sizeKB} KB | ${hasDetail}`);
  }

  await pool.end();
}
main();
