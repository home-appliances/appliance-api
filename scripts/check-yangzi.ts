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
    SELECT p.id, p.name, p.brand, p.model, p.image_id,
           i.mime_type, octet_length(i.image_data) as size
    FROM products p
    LEFT JOIN images i ON p.image_id = i.id
    WHERE p.name LIKE '%KFRd-23GW/080-E3%' OR p.model LIKE '%080-E3%'
  `);

  console.log('查询结果:\n');
  for (const p of result.rows) {
    console.log(`产品ID: ${p.id}`);
    console.log(`名称: ${p.name}`);
    console.log(`品牌: ${p.brand}`);
    console.log(`型号: ${p.model}`);
    console.log(`图片ID: ${p.image_id}`);
    console.log(`图片格式: ${p.mime_type || '无'}`);
    console.log(`图片大小: ${p.size ? (p.size / 1024).toFixed(1) + ' KB' : '无'}`);
    console.log(`图片URL: /api/image/${p.image_id}`);
    console.log('');
  }

  // 测试图片接口
  if (result.rows.length > 0 && result.rows[0].image_id) {
    const imgId = result.rows[0].image_id;
    console.log(`测试图片接口 /api/image/${imgId}:`);
    try {
      const response = await fetch(`http://localhost:3000/api/image/${imgId}`);
      console.log(`  状态码: ${response.status}`);
      console.log(`  Content-Type: ${response.headers.get('content-type')}`);
      console.log(`  Content-Length: ${response.headers.get('content-length')}`);
    } catch (e) {
      console.log(`  错误: ${e}`);
    }
  }

  await pool.end();
}
main();
