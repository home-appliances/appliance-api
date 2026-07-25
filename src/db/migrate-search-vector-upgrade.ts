/**
 * 升级 search_vector 全文搜索（加权版）
 *
 * 改动：
 *   1. products 新增 params_search_text 字段（缓存 params 的 value 文本，便于排查）
 *   2. 替换 products_search_vector_update() 为加权版：
 *      name=A(最高权重) | brand+model=B | params=D(最低)
 *   3. 重建触发器（BEFORE INSERT OR UPDATE OF name, brand, model, params）
 *   4. 回填现有数据
 *
 * 不改动：图片仍用 product_images 表，不加 main_image / image_id。
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
  const client = await pool.connect();
  try {
    console.log('🔧 升级 search_vector 全文搜索（加权版）...\n');

    // 1. 新增 params_search_text 字段
    console.log('1️⃣ 新增 params_search_text 字段...');
    await client.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS params_search_text text;
    `);
    console.log('   ✅ 完成');

    // 2. 替换为加权版函数
    console.log('2️⃣ 替换为加权版 search_vector 函数...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.products_search_vector_update() RETURNS trigger
      LANGUAGE plpgsql AS $$
        DECLARE
          params_text text;
        BEGIN
          -- 把 params 所有 value 聚合成一段文本
          SELECT string_agg(val, ' ')
            INTO params_text
            FROM (
              SELECT trim(value) AS val
              FROM jsonb_each_text(COALESCE(NEW.params, '{}'::jsonb))
              WHERE NULLIF(trim(value), '') IS NOT NULL
            ) s;

          NEW.params_search_text := params_text;

          -- 加权：name=A(最高), brand+model=B, params=D(最低)
          NEW.search_vector :=
            setweight(to_tsvector('jiebacfg', COALESCE(NEW.name, '')), 'A') ||
            setweight(
              to_tsvector('jiebacfg', trim(COALESCE(NEW.brand, '') || ' ' || COALESCE(NEW.model, ''))),
              'B'
            ) ||
            setweight(to_tsvector('jiebacfg', COALESCE(params_text, '')), 'D');

          RETURN NEW;
        END;
      $$;
    `);
    console.log('   ✅ 完成');

    // 3. 重建触发器（只在相关字段变更时触发）
    console.log('3️⃣ 重建触发器...');
    await client.query(`DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;`);
    await client.query(`
      CREATE TRIGGER products_search_vector_trigger
        BEFORE INSERT OR UPDATE OF name, brand, model, params
        ON products
        FOR EACH ROW
        EXECUTE FUNCTION public.products_search_vector_update();
    `);
    console.log('   ✅ 完成');

    // 4. 回填现有数据（触发 UPDATE 让新函数生效）
    console.log('4️⃣ 回填现有数据...');
    const r = await client.query(`
      UPDATE products SET name = name WHERE id IS NOT NULL;
    `);
    console.log(`   ✅ 触发更新 ${r.rowCount} 条`);

    // 5. 验证
    console.log('\n📝 验证:');
    const v = await client.query(`
      SELECT id, name,
             left(params_search_text, 60) as params_text_preview,
             ts_rank(search_vector, to_tsquery('jiebacfg', '格力')) as rank_ge_li
      FROM products
      ORDER BY id LIMIT 5;
    `);
    for (const row of v.rows) {
      console.log(`   [${row.id}] ${row.name}`);
      console.log(`       params_text: ${row.params_text_preview || '(空)'}`);
    }

    // 测试加权效果
    const test = await client.query(`
      SELECT name, ts_rank(search_vector, to_tsquery('jiebacfg', '格力')) as rank
      FROM products
      WHERE search_vector @@ to_tsquery('jiebacfg', '格力')
      ORDER BY rank DESC;
    `);
    console.log('\n   搜索"格力"命中:');
    for (const row of test.rows) {
      console.log(`     ${row.name} -> rank=${row.rank}`);
    }

    console.log('\n🎉 升级完成!');
  } catch (e) {
    console.error('❌ 失败:', e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
