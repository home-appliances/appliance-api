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
    SELECT i.id, i.mime_type, octet_length(i.image_data) as size,
           p.id as product_id, p.name, p.brand, p.model
    FROM images i
    LEFT JOIN products p ON p.image_id = i.id
    WHERE i.mime_type = 'image/gif'
  `);

  console.log('GIF 图片详情:\n');
  for (const img of result.rows) {
    console.log(`图片ID: ${img.id}`);
    console.log(`大小: ${(img.size / 1024).toFixed(1)} KB`);
    console.log(`关联产品: ${img.product_id || '无'}`);
    console.log(`产品名称: ${img.name || '无'}`);
    console.log(`品牌: ${img.brand || '无'}`);
    console.log(`型号: ${img.model || '无'}`);
  }

  await pool.end();
}
main();
