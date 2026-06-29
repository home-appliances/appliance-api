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
    SELECT p.id, p.brand, p.model, p.source_url
    FROM products p
    JOIN images i ON p.image_id = i.id
    WHERE octet_length(i.image_data) < 5120
    ORDER BY p.id
  `);

  console.log('剩余小图产品的详情页URL:\n');

  for (const p of result.rows) {
    console.log(`[${p.id}] ${p.brand} ${p.model}`);
    console.log(`   ${p.source_url}`);
  }

  await pool.end();
}
main();
