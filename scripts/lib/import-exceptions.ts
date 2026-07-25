/**
 * 导入例外落库 / 导出
 */
import fs from 'fs';
import path from 'path';
import type pg from 'pg';
import type { ParamException } from '../../src/utils/normalize-param-value.js';

export type ExceptionRow = ParamException & {
  sourceUrl?: string | null;
  productName?: string | null;
  productId?: number | null;
};

export async function ensureImportExceptionsTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS import_exceptions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      batch_id TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      category_id BIGINT,
      product_id BIGINT,
      source_url TEXT,
      product_name TEXT,
      exception_type TEXT NOT NULL,
      param_key TEXT NOT NULL,
      raw_value TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_import_exceptions_batch
      ON import_exceptions (batch_id)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_import_exceptions_open
      ON import_exceptions (source_platform, status)
  `);
}

/** 新批次写入前：同平台旧 open 标为 superseded，避免堆积漏看 */
export async function supersedeOpenExceptions(
  pool: pg.Pool,
  sourcePlatform: string
): Promise<number> {
  const r = await pool.query(
    `UPDATE import_exceptions SET status = 'superseded'
     WHERE source_platform = $1 AND status = 'open'
     RETURNING id`,
    [sourcePlatform]
  );
  return r.rowCount || 0;
}

export async function insertExceptions(
  pool: pg.Pool,
  opts: {
    batchId: string;
    sourcePlatform: string;
    categoryId: number | string;
    rows: ExceptionRow[];
  }
): Promise<number> {
  if (opts.rows.length === 0) return 0;

  let inserted = 0;
  const chunk = 200;
  for (let i = 0; i < opts.rows.length; i += chunk) {
    const part = opts.rows.slice(i, i + chunk);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    for (const r of part) {
      const status = r.type === 'value_discarded' ? 'resolved' : 'open';
      placeholders.push(
        `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
      );
      values.push(
        opts.batchId,
        opts.sourcePlatform,
        opts.categoryId,
        r.productId ?? null,
        r.sourceUrl ?? null,
        r.productName ?? null,
        r.type,
        r.paramKey,
        r.rawValue,
        r.reason,
        status
      );
    }
    await pool.query(
      `INSERT INTO import_exceptions
        (batch_id, source_platform, category_id, product_id, source_url,
         product_name, exception_type, param_key, raw_value, reason, status)
       VALUES ${placeholders.join(',')}`,
      values
    );
    inserted += part.length;
  }
  return inserted;
}

export function writeExceptionsJson(
  batchId: string,
  rows: ExceptionRow[],
  outDir = path.join(process.cwd(), 'scripts', 'output')
): string {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `import-exceptions-${batchId}.json`);
  const summary: Record<string, number> = {};
  for (const r of rows) {
    const k = `${r.type}|${r.paramKey}|${r.rawValue}`;
    summary[k] = (summary[k] || 0) + 1;
  }
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        batchId,
        total: rows.length,
        top: Object.entries(summary)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([k, n]) => ({ key: k, count: n })),
        rows,
      },
      null,
      2
    ),
    'utf-8'
  );
  return file;
}

export function printExceptionSummary(rows: ExceptionRow[]): void {
  if (rows.length === 0) {
    console.log('🏷️  例外: 无（全部入座成功）');
    return;
  }
  const byType = new Map<string, number>();
  const byKeyVal = new Map<string, number>();
  let blocking = 0;
  for (const r of rows) {
    byType.set(r.type, (byType.get(r.type) || 0) + 1);
    const kv = `${r.paramKey} = ${r.rawValue}`;
    byKeyVal.set(kv, (byKeyVal.get(kv) || 0) + 1);
    if (r.type !== 'value_discarded') blocking++;
  }
  console.log(`🏷️  例外合计: ${rows.length} 条（其中需人工处理 ${blocking}，规则丢弃 ${rows.length - blocking}）`);
  [...byType.entries()].forEach(([t, n]) => console.log(`   · ${t}: ${n}`));
  console.log('   Top 例外值:');
  [...byKeyVal.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([k, n]) => console.log(`   ${n}× ${k}`));
}
