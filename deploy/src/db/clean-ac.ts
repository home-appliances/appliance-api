#!/usr/bin/env tsx
/** 清空 air_condition 旧数据(保留图片和其他品类) */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
const pool = new pg.Pool({
  host:process.env.DB_HOST, port:Number(process.env.DB_PORT),
  database:process.env.DB_NAME, user:process.env.DB_USER, password:process.env.DB_PASSWORD,
});
const r = await pool.query("DELETE FROM products WHERE category='air_condition'");
console.log(`已删除 ${r.rowCount} 条旧空调数据`);
await pool.end();
