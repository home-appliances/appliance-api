/**
 * ETL 数据质检（ZOL 空调）
 * 用法: npx tsx scripts/check-etl.ts
 */
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'appliance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres123',
});

async function main() {
  const issues: string[] = [];

  const hasRaw = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name='products' AND column_name='raw_params'
    ) AS ok
  `);
  if (hasRaw.rows[0].ok) {
    issues.push('仍存在 products.raw_params（应 DROP，原材料以爬虫 JSON 为准）');
  }

  const stats = await pool.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE params = '{}'::jsonb)::int AS empty_params
    FROM products
    WHERE source_platform = 'zol' AND deleted_at IS NULL
  `);
  console.log('产品', stats.rows[0]);

  const defs = await pool.query(`
    SELECT param_key, param_type, enum_values
    FROM category_params WHERE category_id = (
      SELECT id FROM categories WHERE code = 'air_condition'
    )
  `);
  const defMap = new Map(defs.rows.map((r: { param_key: string }) => [r.param_key, r]));

  const keys = await pool.query(`
    SELECT key, count(*)::int n
    FROM products, jsonb_object_keys(params) AS key
    WHERE source_platform = 'zol' AND deleted_at IS NULL
    GROUP BY key
  `);
  const unknown = keys.rows.filter((r: { key: string }) => !defMap.has(r.key));
  if (unknown.length) {
    issues.push(`params 含未知键: ${unknown.map((u: { key: string }) => u.key).join(',')}`);
  }

  for (const d of defs.rows as Array<{ param_key: string; param_type: string; enum_values: string[] | null }>) {
    if (d.param_type === 'enum' && d.enum_values?.length) {
      const bad = await pool.query(
        `
        SELECT count(*)::int n FROM products
        WHERE source_platform='zol' AND deleted_at IS NULL AND params ? $1
          AND NOT (params->>$1 = ANY($2::text[]))
      `,
        [d.param_key, d.enum_values]
      );
      if (bad.rows[0].n > 0) issues.push(`枚举越界 ${d.param_key}: ${bad.rows[0].n}`);
    }
    if (d.param_type === 'boolean') {
      const bad = await pool.query(
        `
        SELECT count(*)::int n FROM products
        WHERE source_platform='zol' AND deleted_at IS NULL AND params ? $1
          AND params->>$1 NOT IN ('是','否')
      `,
        [d.param_key]
      );
      if (bad.rows[0].n > 0) issues.push(`布尔脏值 ${d.param_key}: ${bad.rows[0].n}`);
    }
  }

  const open = await pool.query(
    `SELECT count(*)::int n FROM import_exceptions WHERE status='open' AND source_platform='zol'`
  );
  console.log('open 例外', open.rows[0].n);
  if (open.rows[0].n > 0) issues.push(`仍有 ${open.rows[0].n} 条 open 例外`);

  const core = await pool.query(`
    SELECT
      count(*) FILTER (WHERE NOT (params ? '空调匹数'))::int AS no_pi,
      count(*) FILTER (WHERE NOT (params ? '能效等级'))::int AS no_neng,
      count(*) FILTER (WHERE NOT (params ? '空调类型'))::int AS no_type
    FROM products WHERE source_platform='zol' AND deleted_at IS NULL
  `);
  console.log('核心字段缺失（多为源站空洞）', core.rows[0]);

  const trig = await pool.query(
    `SELECT pg_get_functiondef(oid) AS def FROM pg_proc WHERE proname='products_search_vector_update'`
  );
  if (!/params/.test(trig.rows[0]?.def || '')) {
    issues.push('search_vector 触发器未包含 params');
  }

  const img = await pool.query(`
    SELECT
      (SELECT EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name='images'
       )) AS images_table_exists,
      (SELECT EXISTS (
         SELECT 1 FROM information_schema.tables WHERE table_name='product_images'
       )) AS product_images_exists,
      count(*) FILTER (WHERE main_image LIKE '/api/image%')::int AS main_api,
      count(*) FILTER (WHERE image_id IS NOT NULL)::int AS with_image_id,
      count(*) FILTER (WHERE main_image LIKE '/local-images/%')::int AS main_local,
      count(*) FILTER (WHERE main_image LIKE '%static.cheapgo.top%')::int AS main_oss
    FROM products WHERE source_platform='zol' AND deleted_at IS NULL
  `);
  console.log('图片', img.rows[0]);
  if (img.rows[0].images_table_exists) {
    issues.push('images 表仍存在，请 DROP（禁止 BYTEA 入库）');
  }
  if (img.rows[0].product_images_exists) {
    issues.push('product_images 表仍存在（已改为仅 main_image），请 DROP');
  }
  if (img.rows[0].main_api > 0) {
    issues.push(`仍有 ${img.rows[0].main_api} 条 main_image 为 /api/image/*`);
  }
  if (img.rows[0].with_image_id > 0) {
    issues.push(`仍有 ${img.rows[0].with_image_id} 条 image_id 未清空`);
  }
  if (img.rows[0].main_local === 0 && img.rows[0].main_oss === 0) {
    issues.push('没有本地 /local-images 或 OSS 主图');
  }

  if (issues.length) {
    console.log('\n❌ ETL 质检未通过:');
    issues.forEach((i) => console.log(' -', i));
    process.exitCode = 1;
  } else {
    console.log('\n✅ ETL 质检通过');
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
