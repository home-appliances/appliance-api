/**
 * 从现网导出空调 category_params 快照（ETL 维度表真相源）
 * 用法: npx tsx scripts/export-category-params-snapshot.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

async function main() {
  const catCode = process.argv[2] || 'air_condition';
  const r = await pool.query(
    `
    SELECT cp.param_key, cp.display_name, cp.icon, cp.param_type,
           cp.is_core, cp.is_filter, cp.is_sortable, cp.enum_values, cp.sort_order
    FROM category_params cp
    JOIN categories c ON c.id = cp.category_id
    WHERE c.code = $1
    ORDER BY cp.sort_order, cp.id
  `,
    [catCode]
  );

  const outDir = path.join(__dirname, '..', 'src', 'db', 'snapshots');
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `category-params-${catCode}.json`);
  fs.writeFileSync(out, JSON.stringify(r.rows, null, 2), 'utf-8');
  console.log(`✅ 导出 ${r.rows.length} 条 → ${out}`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
