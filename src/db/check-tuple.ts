/** 统计数组中参数(推断错误)的记录 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});

// 统计 params 中某字段是数组的记录数
const fields = ['空调类型', '冷暖类型', '变频/定频', '产品类别'];
for (const f of fields) {
  const r = await p.query(
    `SELECT count(*)::int as n FROM products WHERE category='air_condition' AND jsonb_typeof(params->$1) = 'array'`,
    [f]
  );
  console.log(`${f}: ${r.rows[0].n} 条数组`);
}

// 总记录
const r2 = await p.query(`SELECT count(*)::int as n FROM products WHERE category='air_condition'`);
console.log(`\n空调总数: ${r2.rows[0].n}`);
await p.end();
