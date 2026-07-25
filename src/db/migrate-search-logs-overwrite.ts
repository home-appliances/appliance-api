/**
 * 用 dump 数据覆盖 search_logs
 *
 * 生产现状: 81 条（含 JNDI 注入、SQL 注入、乱码、测试垃圾）
 * dump: 14 条干净的真实搜索数据
 *
 * 策略: 清空后导入 dump 数据（含指定 id）
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

// dump 里的 14 条数据: [id, keyword, search_count, last_searched_at, created_at]
const searchLogs = [
  [1, '小米', 1, '2026-07-22 17:36:34.194443', '2026-07-22 17:36:34.194443'],
  [4, '大金', 17, '2026-07-26 00:17:02.882308', '2026-07-24 10:03:43.806181'],
  [48, '一级', 9, '2026-07-26 00:28:32.176915', '2026-07-25 18:36:57.69386'],
  [70, '4564564', 1, '2026-07-26 00:28:39.237704', '2026-07-26 00:28:39.237704'],
  [71, '办公', 1, '2026-07-26 00:29:23.733', '2026-07-26 00:29:23.733'],
  [72, '尺寸', 1, '2026-07-26 00:29:50.315562', '2026-07-26 00:29:50.315562'],
  [73, 'KY-20F1', 1, '2026-07-26 00:30:17.242338', '2026-07-26 00:30:17.242338'],
  [13, '变频', 1, '2026-07-24 20:20:22.98837', '2026-07-24 20:20:22.98837'],
  [46, '美的', 1, '2026-07-25 18:36:57.69386', '2026-07-25 18:36:57.69386'],
  [47, '一级能效', 2, '2026-07-25 18:40:59.173673', '2026-07-25 18:36:57.69386'],
  [49, '能效', 3, '2026-07-25 18:40:59.173673', '2026-07-25 18:36:57.69386'],
  [54, '工业空调', 1, '2026-07-25 18:41:50.493015', '2026-07-25 18:41:50.493015'],
  [56, '空调', 1, '2026-07-25 18:41:50.493015', '2026-07-25 18:41:50.493015'],
  [21, '中央空调', 25, '2026-07-25 23:38:23.352492', '2026-07-25 03:02:42.289329'],
  [2, '格力空调', 6, '2026-07-26 00:12:13.771792', '2026-07-24 10:02:58.667546'],
];

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔧 覆盖 search_logs...\n');

    // 备份当前数量（备查）
    const before = await client.query('SELECT COUNT(*) as c FROM search_logs');
    console.log(`   覆盖前: ${before.rows[0].c} 条`);

    // 1. 清空
    console.log('1️⃣ 清空 search_logs...');
    await client.query('DELETE FROM search_logs;');
    console.log('   ✅ 完成');

    // 2. 导入 dump 数据
    console.log(`2️⃣ 导入 dump 数据 (${searchLogs.length} 条)...`);
    for (const [id, keyword, searchCount, lastSearchedAt, createdAt] of searchLogs) {
      await client.query(`
        INSERT INTO search_logs (id, keyword, search_count, last_searched_at, created_at)
        OVERRIDING SYSTEM VALUE
        VALUES ($1, $2, $3, $4, $5)
      `, [id, keyword, searchCount, lastSearchedAt, createdAt]);
    }
    // 重置序列到最大 id
    await client.query(`SELECT setval('search_logs_id_seq', GREATEST(MAX(id), 73), true) FROM search_logs;`);
    console.log('   ✅ 完成');

    // 3. 验证
    console.log('\n📝 验证:');
    const after = await client.query('SELECT COUNT(*) as c FROM search_logs');
    console.log(`   覆盖后: ${after.rows[0].c} 条`);

    const r = await client.query('SELECT id, keyword, search_count FROM search_logs ORDER BY search_count DESC');
    console.log('\n   搜索日志（按次数排序）:');
    for (const row of r.rows) {
      console.log(`     [${row.id}] ${row.keyword} | ${row.search_count} 次`);
    }

    console.log('\n🎉 覆盖完成!');
  } catch (e) {
    console.error('❌ 失败:', e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
