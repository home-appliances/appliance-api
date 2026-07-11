/**
 * appliance_db 跨实例迁移脚本
 * 源: 家电实例 pgm-wz97275grs6n76224o / appliance_db / Aa_123
 * 目标: 奇购实例 pgm-wz926p594292r913zo / appliance_db / rwrwrw2224
 * 方式: CREATE TABLE (LIKE) 复制结构 + COPY 流式传数据
 */
import pg from 'pg';
import { Readable } from 'stream';

const SRC = {
  host: 'pgm-wz97275grs6n76224o.rwlb.rds.aliyuncs.com',
  port: 5432,
  database: 'appliance_db',
  user: 'Aa_123',
  password: 'Aa_123456_Reset_2026',
};
const DST = {
  host: 'pgm-wz926p594292r913zo.rwlb.rds.aliyuncs.com',
  port: 5432,
  database: 'appliance_db',
  user: 'rwrwrw2224',
  password: 'UyVjL3aRxB2PaM6j',
};

// 迁移顺序: 先无外键依赖的, images 在 products 之前(products.image_id -> images.id)
const TABLES = [
  'images',
  'categories',
  'admins',
  'system_settings',
  'crawler_tasks',
  'air_conditioners',
  'operation_logs',
  'search_logs',
  'products',
];

function log(...a) { console.log('[' + new Date().toISOString().slice(11,19) + ']', ...a); }

async function main() {
  const src = new pg.Client(SRC);
  const dst = new pg.Client(DST);
  await src.connect();
  await dst.connect();
  log('✅ 源/目标库均已连接');

  // 0. 获取所有表的实际 DDL (用 pg_get_tabledef 不通用, 改用 pg_dump 内部查询)
  // 直接用 CREATE TABLE LIKE 包括所有列+约束(不含索引和外键,需单独建)
  for (const table of TABLES) {
    log(`--- 迁移表: ${table} ---`);

    // 1. 目标库建表: CREATE TABLE ... (LIKE source INCLUDING ALL)
    //    INCLUDING ALL = 含默认值/约束/索引/注释, 但不含外键(外键需显式)
    //    但 LIKE 不能跨库, 所以先从源库取建表语句
    const ddlRows = await src.query(`
      SELECT 'CREATE TABLE ' || quote_ident($1) || ' (' ||
        string_agg(
          '  ' || quote_ident(a.attname) || ' ' ||
          pg_catalog.format_type(a.atttypid, a.atttypmod) ||
          CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
          CASE WHEN a.atthasdef THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid) ELSE '' END,
          E',\n' ORDER BY a.attnum
        ) || E'\n)' AS ddl
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
      WHERE c.relname = $1 AND n.nspname='public' AND a.attnum > 0 AND NOT a.attisdropped
      GROUP BY c.relname
    `, [table]);

    // 先删目标表(如有, 幂等重跑)
    await dst.query(`DROP TABLE IF EXISTS ${quote(table)} CASCADE`);
    log(`  已 DROP (若存在)`);

    await dst.query(ddlRows.rows[0].ddl);
    log(`  已建表结构`);

    // 2. 获取源表行数
    const cnt = await src.query(`SELECT count(*) AS n FROM ${quote(table)}`);
    const total = parseInt(cnt.rows[0].n);
    log(`  源行数: ${total}`);

    if (total > 0) {
      // 3. COPY 流式: 源 STDOUT -> 目标 STDIN
      //    用 csv 格式, 避免二进制对齐问题
      const copyOut = `COPY ${quote(table)} TO STDOUT WITH (FORMAT csv)`;
      const copyIn = `COPY ${quote(table)} FROM STDIN WITH (FORMAT csv)`;

      const srcStream = src.query(new pg.Query(copyOut));
      // pg 的 COPY TO STDOUT 通过 SubmissionReadStream 或 stream 事件
      // 使用 pg 的 SubmissionReadStream
      const { SubmissionReadStream } = await import('@libsql/streaming');
      // 上面 import 可能失败, 改用 pg 原生方式
    }
  }

  await src.end();
  await dst.end();
  log('🎉 完成');
}

function quote(s) { return '"' + s.replace(/"/g,'""') + '"'; }

main().catch(e => { console.error('❌ 致命错误:', e); process.exit(1); });
