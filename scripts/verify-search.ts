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
  console.log('🔍 验证搜索功能:\n');

  const tests = ['科龙', '海信', '卡萨帝', '海尔', '三菱电机', '三菱', '小米', '米家'];

  for (const keyword of tests) {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM products
      WHERE brand ILIKE $1 OR name ILIKE $2
    `, [`%${keyword}%`, `%${keyword}%`]);
    console.log(`搜索 "${keyword}": ${result.rows[0].count} 条`);
  }

  await pool.end();
}
main();
