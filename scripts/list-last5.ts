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
    SELECT p.id, p.brand, p.model, p.name, p.source_url
    FROM products p
    JOIN images i ON p.image_id = i.id
    WHERE octet_length(i.image_data) < 5120
    ORDER BY p.id
  `);

  console.log('最后 5 张小图产品的详情页:\n');

  for (const p of result.rows) {
    console.log(`[${p.id}] ${p.brand} ${p.model}`);
    console.log(`   名称: ${p.name}`);
    console.log(`   详情页: ${p.source_url}`);
    console.log('');
  }

  await pool.end();
}
main();
