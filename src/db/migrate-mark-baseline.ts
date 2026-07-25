/**
 * 标记 baseline migration 已在生产执行
 *
 * 生产 DB 已经是目标状态，不需要真的跑 0000_baseline.sql。
 * 在 __drizzle_migrations 表插入一条记录，让 CI 迁移时跳过 baseline。
 *
 * Drizzle migrator 表结构（固定）：
 *   CREATE TABLE "__drizzle_migrations" (
 *     id SERIAL PRIMARY KEY,
 *     hash text NOT NULL,
 *     created_at numeric
 *   )
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();
import { readFileSync, readdirSync } from 'fs';
import { createHash } from 'crypto';

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
    console.log('📋 标记 baseline migration 已执行...\n');

    // 1. 建 __drizzle_migrations 表（如果不存在）
    await c.query(`
      CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
    `);
    console.log('✅ __drizzle_migrations 表已就绪');

    // 2. 读 drizzle/_journal.json 拿到 migration 列表和 hash
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
    console.log(`\n迁移文件列表 (${journal.entries.length} 个):`);
    for (const entry of journal.entries) {
      console.log(`  - ${entry.idx}: ${entry.tag} (when=${entry.when})`);
    }

    // 3. 计算每个 migration 的 hash（Drizzle 用文件内容的前 8 位 sha256）
    const sqlFiles = readdirSync('drizzle')
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of sqlFiles) {
      const content = readFileSync(`drizzle/${file}`, 'utf8');
      const hash = createHash('sha256').update(content).digest('hex');

      // 检查是否已记录
      const exists = await c.query('SELECT id FROM __drizzle_migrations WHERE hash = $1', [hash]);
      if (exists.rows.length > 0) {
        console.log(`\n⏭️  ${file} 已记录 (id=${exists.rows[0].id})，跳过`);
        continue;
      }

      // 插入记录（created_at 用当前时间戳，单位秒）
      const inserted = await c.query(
        'INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2) RETURNING id',
        [hash, Date.now()]
      );
      console.log(`\n✅ 标记 ${file} 为已执行 (id=${inserted.rows[0].id}, hash=${hash.slice(0, 16)}...)`);
    }

    // 4. 验证
    const all = await c.query('SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id');
    console.log('\n=== __drizzle_migrations 当前记录 ===');
    for (const r of all.rows) {
      console.log(`  [${r.id}] hash=${r.hash.slice(0, 16)}... created_at=${r.created_at}`);
    }

    console.log('\n🎉 baseline 标记完成！CI 迁移时会跳过已执行的 baseline。');
  } catch (e) {
    console.error('❌ 失败:', e);
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}

main();
