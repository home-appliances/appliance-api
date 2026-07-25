/**
 * 删除残留空表（baseline 清理）
 *
 * - air_conditioners: 早期单品类表，已废弃（空表）
 * - crawler_tasks: 爬虫任务表，项目已移除爬虫模块（空表）
 * - jieba_user_dict: pg_jieba 扩展自带词典表，【保留】
 *
 * 在生产 DB 执行一次即可。
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
    console.log('🧹 清理残留空表...\n');

    for (const table of ['air_conditioners', 'crawler_tasks']) {
      // 确认是空表才删
      const cnt = await c.query(`SELECT COUNT(*) as c FROM ${table}`);
      const count = parseInt(cnt.rows[0].c, 10);
      if (count > 0) {
        console.log(`⚠️  ${table} 有 ${count} 条数据，跳过删除（请人工确认）`);
        continue;
      }
      await c.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✅ 删除 ${table}（空表）`);
    }

    // 验证剩余表
    const tables = await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
    console.log('\n剩余表:');
    console.log(tables.rows.map((r: any) => '  ' + r.tablename).join('\n'));
  } finally {
    c.release();
    await pool.end();
  }
}

main();
