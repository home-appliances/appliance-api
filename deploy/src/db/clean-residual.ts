/** 查旧残留并按source_platform分组,删除非zol的旧数据 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const p = new pg.Pool({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});

// 查分组
const r = await p.query("SELECT count(*)::int as n, source_platform FROM products WHERE category='air_condition' GROUP BY source_platform");
console.log('按source_platform分组:');
for (const row of r.rows) console.log(`  ${row.source_platform}: ${row.n}`);

// 删旧残留
const d = await p.query("DELETE FROM products WHERE category='air_condition' AND source_platform != 'zol'");
console.log(`\n删除了 ${d.rowCount} 条旧残留`);

const total = await p.query("SELECT count(*)::int as n FROM products WHERE category='air_condition'");
console.log(`当前空调总数: ${total.rows[0].n}`);
await p.end();
