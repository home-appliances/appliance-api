/**
 * 对比 schema.ts 和生产 DB 的实际结构，找出差异
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  const c = await pool.connect();
  try {
    // 1. 所有表
    const tables = await c.query(`
      SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
    `);
    console.log('=== 生产 DB 所有表 ===');
    console.log(tables.rows.map(r => r.tablename).join(', '));

    // 2. products 表字段类型
    const cols = await c.query(`
      SELECT column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'products' ORDER BY ordinal_position;
    `);
    console.log('\n=== products 表字段（生产实际）===');
    for (const r of cols.rows) {
      const typ = r.udt_name === 'tsvector' ? 'tsvector' : r.data_type;
      console.log(`  ${r.column_name}: ${typ} | nullable=${r.is_nullable} | default=${r.column_default || '无'}`);
    }

    // 3. 时间戳字段类型
    const ts = await c.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE data_type LIKE 'timestamp%' AND table_schema='public' AND table_name IN ('products','categories','admins','search_logs','operation_logs','system_settings','category_params','product_images')
      ORDER BY table_name, column_name;
    `);
    console.log('\n=== 时间戳字段类型 ===');
    for (const r of ts.rows) {
      console.log(`  ${r.table_name}.${r.column_name}: ${r.data_type}`);
    }

    // 4. 检查 search_vector 字段类型
    const sv = await c.query(`
      SELECT table_name, column_name, udt_name
      FROM information_schema.columns
      WHERE column_name = 'search_vector' AND table_schema='public';
    `);
    console.log('\n=== search_vector 字段 ===');
    for (const r of sv.rows) {
      console.log(`  ${r.table_name}.${r.column_name}: ${r.udt_name}`);
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main();
