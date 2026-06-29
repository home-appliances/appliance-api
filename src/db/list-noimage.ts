/** 列出无图产品清单(含详情页) */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});

const r = await p.query(
  `SELECT id, name, brand, source_url, params->>'匹数' as capacity,
          params->>'空调类型' as ac_type
   FROM products WHERE category='air_condition' AND image_id IS NULL
   ORDER BY brand`
);
console.log(`无图产品: ${r.rows.length} 条\n`);
for (const row of r.rows) {
  console.log(`[${row.brand}] ${(row.name||'').slice(0,30)}`);
  console.log(`  详情页: ${row.source_url}`);
  console.log(`  类型: ${row.ac_type||'?'}  匹数: ${row.capacity||'?'}`);
  console.log('');
}
await p.end();
