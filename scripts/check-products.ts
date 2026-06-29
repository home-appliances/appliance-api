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
  // 搜索这两个产品
  const result = await pool.query(`
    SELECT p.id, p.name, p.brand, p.model, p.images, p.image_id,
           i.mime_type, octet_length(i.image_data) as image_bytes
    FROM products p
    LEFT JOIN images i ON p.image_id = i.id
    WHERE p.name ILIKE '%中松%' OR p.name ILIKE '%余平%'
       OR p.model ILIKE '%DALHZZZSA%' OR p.model ILIKE '%KY-32%'
    ORDER BY p.id
  `);

  console.log('查询结果:\n');

  for (const p of result.rows) {
    console.log(`ID: ${p.id}`);
    console.log(`品牌: ${p.brand}`);
    console.log(`型号: ${p.model}`);
    console.log(`名称: ${p.name}`);
    console.log(`原始图片URL: ${p.images && p.images.length > 0 ? p.images[0] : '无'}`);
    console.log(`图片ID: ${p.image_id || '无'}`);

    if (p.image_id) {
      console.log(`图片格式: ${p.mime_type}`);
      console.log(`图片大小: ${(p.image_bytes / 1024).toFixed(1)} KB`);
    }

    console.log('---');
  }

  await pool.end();
}
main();
