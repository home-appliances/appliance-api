/**
 * 自动数据库迁移
 *
 * 流程：
 *   1. pg_advisory_lock 防并发（多实例只一个能跑）
 *   2. 读 drizzle/ 下所有 .sql migration 文件
 *   3. 对比 __drizzle_migrations 表，找出未执行的
 *   4. 按顺序执行未执行的 migration，记录到 __drizzle_migrations
 *   5. 释放锁
 *
 * 失败处理：任何 migration 执行失败则抛错（不继续后续 migration），
 * 由调用方决定是否阻塞服务。
 *
 * 在 FC 里通过迁移接口调用，走 VPC 内网连 DB。
 */

import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { join } from 'path';

// advisory lock 的 key（固定值，所有实例用同一个）
const ADVISORY_LOCK_KEY = 882347193;

// __drizzle_migrations 表 DDL（Drizzle 官方结构）
const MIGRATIONS_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at numeric
  );
`;

export interface MigrationResult {
  executed: string[];      // 本次执行的 migration 文件名
  skipped: string[];       // 已执行跳过的
  error?: string;          // 失败时的错误信息
}

/**
 * 执行自动迁移
 * @returns 执行结果（executed 为空表示无需迁移）
 */
export async function migrateAuto(): Promise<MigrationResult> {
  // migration 文件目录：优先用进程运行目录的 drizzle/（FC 打包后在代码根目录）
  const candidates = [
    join(process.cwd(), 'drizzle'),
    join(__dirname, '..', '..', 'drizzle'),
    join(__dirname, 'drizzle'),
  ];
  const migrationsDir = candidates.find(p => existsSync(p));

  if (!migrationsDir) {
    // 没找到 migration 目录，跳过（可能是本地开发环境没生成）
    return { executed: [], skipped: [], error: '未找到 drizzle/ migration 目录' };
  }

  const pool = new pg.Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 1,  // 迁移用单连接
    connectionTimeoutMillis: 5000,
  });

  const client = await pool.connect();
  const result: MigrationResult = { executed: [], skipped: [] };

  try {
    // 1. 拿 advisory lock（try，拿不到说明有其他实例在跑，直接跳过）
    const lockResult = await client.query('SELECT pg_try_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    const gotLock = lockResult.rows[0].pg_try_advisory_lock;

    if (!gotLock) {
      // 其他实例正在迁移，跳过
      return { executed: [], skipped: [], error: '其他实例正在迁移，跳过' };
    }

    try {
      // 2. 确保迁移表存在
      await client.query(MIGRATIONS_TABLE_DDL);

      // 3. 读已执行的 migration hash
      const executedRows = await client.query('SELECT hash FROM __drizzle_migrations');
      const executedHashes = new Set(executedRows.rows.map((r: any) => r.hash));

      // 4. 读 migration 文件并按文件名排序
      const sqlFiles = readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

      // 5. 逐个执行未跑的 migration
      for (const file of sqlFiles) {
        const content = readFileSync(join(migrationsDir, file), 'utf8');
        const hash = createHash('sha256').update(content).digest('hex');

        if (executedHashes.has(hash)) {
          result.skipped.push(file);
          continue;
        }

        // 执行 migration（事务包裹，失败则回滚该 migration）
        await client.query('BEGIN');
        try {
          // Drizzle 生成的 SQL 用 --> statement-breakpoint 分隔语句
          const statements = content
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0);

          for (const stmt of statements) {
            await client.query(stmt);
          }

          // 记录已执行
          await client.query(
            'INSERT INTO __drizzle_migrations (hash, created_at) VALUES ($1, $2)',
            [hash, Date.now()]
          );

          await client.query('COMMIT');
          result.executed.push(file);
          console.log(`[migrate] ✅ 执行 ${file}`);
        } catch (err: any) {
          await client.query('ROLLBACK');
          result.error = `${file} 执行失败: ${err.message}`;
          console.error(`[migrate] ❌ ${file} 失败:`, err.message);
          throw err;
        }
      }
    } finally {
      // 释放锁
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]);
    }

    return result;
  } finally {
    client.release();
    await pool.end();
  }
}
