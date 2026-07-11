/**
 * appliance_db 跨实例迁移脚本 (分页 SELECT + 批量 INSERT)
 * 源: pgm-wz97275grs6n76224o / appliance_db / Aa_123
 * 目标: pgm-wz926p594292r913zo / appliance_db / rwrwrw2224
 *
 * 策略: 每张表用主键(id)游标分页, 批量 SELECT + 参数化 INSERT。
 *   - 简单稳定, 不依赖 COPY 流 API
 *   - 大表 images (857MB BYTEA) 用小批次
 *   - 临时关闭外键/触发器, 迁移后重建索引+序列
 */
const pg = require('pg');

const SRC = {
  host: 'pgm-wz97275grs6n76224o.rwlb.rds.aliyuncs.com', port: 5432,
  database: 'appliance_db', user: 'Aa_123', password: 'Aa_123456_Reset_2026',
};
const DST = {
  host: 'pgm-wz926p594292r913zo.rwlb.rds.aliyuncs.com', port: 5432,
  database: 'appliance_db', user: 'rwrwrw2224', password: 'UyVjL3aRxB2PaM6j',
};

const TABLES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['images', 'categories', 'admins', 'system_settings',
     'crawler_tasks', 'air_conditioners', 'operation_logs', 'search_logs', 'products'];

const BATCH = { images: 500, products: 1000 };
function batchFor(t) { return BATCH[t] || 2000; }

// 这些表只建空结构, 不迁数据 (逻辑即将改, 旧数据无意义)
const SKIP_DATA = new Set(['images']);

function log(...a) { console.log('[' + new Date().toISOString().slice(11,19) + ']', ...a); }
function q(s) { return '"' + s.replace(/"/g, '""') + '"'; }

async function migrateTable(src, dst, table) {
  log(`\n=== 迁移表: ${table} ===`);

  // 1. 列名
  const colRes = await src.query(`
    SELECT a.attname
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = $1 AND n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
  `, [table]);
  const cols = colRes.rows.map(r => r.attname);
  const colList = cols.map(c => q(c)).join(', ');
  const hasId = cols.includes('id');

  // 2. 建表 DDL
  // id 列用 BIGSERIAL (自动建序列+默认值+owner), 跳过其源库默认值表达式;
  // 其余列保留类型/约束/默认值
  const ddlRes = await src.query(`
    SELECT
      'CREATE TABLE ' || quote_ident($1) || ' (' ||
      string_agg(
        '  ' || quote_ident(a.attname) || ' ' ||
        CASE WHEN a.attname = 'id' AND format_type(a.atttypid, a.atttypmod) IN ('bigint','integer','smallint')
             THEN 'BIGSERIAL'
             ELSE pg_catalog.format_type(a.atttypid, a.atttypmod) END ||
        CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN a.attname = 'id' AND format_type(a.atttypid, a.atttypmod) IN ('bigint','integer','smallint')
             THEN '' ELSE COALESCE(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') END,
        E',\n' ORDER BY a.attnum
      ) || E'\n);' AS ddl
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE c.relname = $1 AND n.nspname = 'public' AND a.attnum > 0 AND NOT a.attisdropped
    GROUP BY c.relname
  `, [table]);

  await dst.query(`DROP TABLE IF EXISTS ${q(table)} CASCADE`);
  await dst.query(ddlRes.rows[0].ddl);
  log(`  已建表 (${cols.length} 列)`);

  // 跳过数据的表: 只建结构, 清空已有数据 (幂等)
  if (SKIP_DATA.has(table)) {
    await dst.query(`TRUNCATE TABLE ${q(table)} RESTART IDENTITY`);
    log(`  ⏭️  跳过数据迁移 (逻辑即将改), 已建空表`);
    return { source: 0, target: 0, ok: true, skipped: true };
  }

  // 3. 源行数
  const cntRes = await src.query(`SELECT count(*) n FROM ${q(table)}`);
  const total = parseInt(cntRes.rows[0].n);
  log(`  源行数: ${total}`);
  if (total === 0) return { source: 0, target: 0 };

  // 4. 分页读 + 批量插
  const batch = batchFor(table);
  let migrated = 0;
  let lastId = -1;
  const placeholders = cols.map((_, i) => '$' + (i + 1)).join(', ');
  const insertSql = `INSERT INTO ${q(table)} (${colList}) VALUES (${placeholders})`;

  while (true) {
    let rows;
    if (hasId) {
      rows = await src.query(
        `SELECT ${colList} FROM ${q(table)} WHERE id > $1 ORDER BY id LIMIT $2`,
        [lastId, batch]
      );
      if (rows.rows.length > 0) lastId = rows.rows[rows.rows.length - 1].id;
    } else {
      rows = await src.query(
        `SELECT ${colList} FROM ${q(table)} OFFSET $1 LIMIT $2`,
        [migrated, batch]
      );
    }

    if (rows.rows.length === 0) break;

    await dst.query('BEGIN');
    try {
      for (const row of rows.rows) {
        const vals = cols.map(c => row[c]);
        await dst.query(insertSql, vals);
      }
      await dst.query('COMMIT');
    } catch (e) {
      await dst.query('ROLLBACK');
      throw new Error(`表 ${table} 插入失败 (已迁 ${migrated} 行): ${e.message}`);
    }

    migrated += rows.rows.length;
    if (migrated % (batch * 5) === 0 || migrated >= total) {
      log(`  ${table}: ${migrated}/${total} (${(migrated/total*100).toFixed(1)}%)`);
    }
    if (rows.rows.length < batch) break;
  }

  const tgtCnt = await dst.query(`SELECT count(*) n FROM ${q(table)}`);
  const got = parseInt(tgtCnt.rows[0].n);
  log(`  ${table}: 源 ${total} -> 目标 ${got} ${got === total ? '✅' : '❌'}`);
  return { source: total, target: got, ok: got === total };
}

async function main() {
  const src = new pg.Client(SRC);
  const dst = new pg.Client(DST);
  await src.connect();
  await dst.connect();
  log('✅ 源/目标库已连接');

  await dst.query('SET session_replication_role = replica;');
  log('目标库: 已临时关闭外键触发器');

  const report = [];
  for (const table of TABLES) {
    const r = await migrateTable(src, dst, table);
    report.push({ table, ...r });
  }

  // 重建索引
  log('\n=== 重建索引 ===');
  for (const table of TABLES) {
    // 用 pg_indexes 视图取索引定义 (PG 通用, 不依赖 pg_index.oid)
    const idx = await src.query(`
      SELECT indexdef AS def
      FROM pg_indexes
      WHERE schemaname='public' AND tablename=$1
      AND indexname NOT IN (
        SELECT conname FROM pg_constraint WHERE conrelid = $2::regclass AND conindid IS NOT NULL
      )
    `, [table, 'public.'+table]).catch(() => src.query(`SELECT indexdef AS def FROM pg_indexes WHERE schemaname='public' AND tablename=$1`, [table]));
    for (const r of idx.rows) {
      try { await dst.query(r.def); } catch (e) { log(`  ${table}: 索引跳过 - ${e.message.slice(0,70)}`); }
    }
    if (idx.rows.length) log(`  ${table}: ${idx.rows.length} 个索引`);
  }

  // 序列重置
  log('\n=== 重置序列 ===');
  for (const table of TABLES) {
    try {
      await dst.query(
        `SELECT setval(pg_get_serial_sequence($1,'id'), COALESCE((SELECT MAX(id) FROM ${q(table)}),0)+1, false)`,
        ['public.'+table]
      );
    } catch (e) { /* 表无 id 序列, 忽略 */ }
  }
  log('序列重置完成');

  await dst.query('SET session_replication_role = DEFAULT;');

  log('\n========== 迁移报告 ==========');
  let allOk = true;
  for (const r of report) {
    log(`  ${r.table}: ${r.source} -> ${r.target} ${r.ok ? '✅' : '❌'}`);
    if (!r.ok) allOk = false;
  }
  log(allOk ? '\n🎉 全部一致, 迁移成功!' : '\n⚠️ 有不一致');

  await src.end();
  await dst.end();
  process.exit(allOk ? 0 : 1);
}

main().catch(e => {
  console.error('❌ 致命错误:', e.message);
  console.error(e.stack);
  process.exit(1);
});
