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
    SELECT p.id, p.name, p.brand, p.model, p.images, p.source_url
    FROM products p
    WHERE p.image_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM images WHERE id = p.image_id)
    ORDER BY p.brand, p.id
  `);

  for (const p of result.rows) {
    const img = p.images && p.images.length > 0 ? p.images[0] : '无';
    console.log(`[${p.id}] ${p.brand} / ${p.model || p.name}`);
    console.log(`  main_image: ${img}`);
    console.log(`  detail_url: ${p.source_url || '无'}`);
    console.log('');
  }

  await pool.end();
}
main();
