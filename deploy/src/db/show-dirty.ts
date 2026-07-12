/** 展示残留脏值 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
const r = await p.query(`
  SELECT name, k, v FROM products
  CROSS JOIN LATERAL jsonb_each_text(params) AS e(k,v)
  WHERE category='air_condition' AND (v ~ '^0W$' OR v ~ '^\\.' OR v ~ '\\d{7,}' OR v ~ '\\d \\d{3}')
  LIMIT 15
`);
for (const row of r.rows) {
  console.log(`[${(row.name||'').slice(0,30)}]  ${row.k}=${row.v.slice(0,50)}`);
}
console.log(`\n共 ${r.rows.length} 处`);
await p.end();
