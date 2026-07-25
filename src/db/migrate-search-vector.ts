/**
 * 全文搜索迁移：params_search_text + 加权 search_vector（pg_jieba）
 * 权重：A=name，B=brand+model，D=params 仅值文本（不含 JSON key）
 * 运行: npm run migrate:search-vector
 */

import { pool } from './index.js';

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('🔧 开始全文搜索迁移（加权 + 参数值文本）...\n');

    console.log('0️⃣ 检查 pg_jieba 扩展...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_jieba;`);
    console.log('   ✅ 完成');

    console.log('1️⃣ 检查 jiebacfg 分词配置...');
    const cfgResult = await client.query(
      `SELECT cfgname FROM pg_ts_config WHERE cfgname = 'jiebacfg'`
    );
    if (cfgResult.rows.length > 0) {
      console.log('   ✅ jiebacfg 配置已存在');
    } else {
      console.log('   ⚠️ jiebacfg 不存在，尝试创建...');
      await client.query(`CREATE TEXT SEARCH CONFIGURATION jiebacfg (PARSER = jieba);`);
    }

    console.log('2️⃣ 添加列 search_vector / params_search_text...');
    await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS params_search_text text;
    `);
    console.log('   ✅ 完成');

    console.log('3️⃣ 创建/更新触发器函数...');
    await client.query(`
      CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
      DECLARE
        params_text text;
      BEGIN
        SELECT string_agg(val, ' ')
          INTO params_text
          FROM (
            SELECT trim(value) AS val
            FROM jsonb_each_text(COALESCE(NEW.params, '{}'::jsonb))
            WHERE NULLIF(trim(value), '') IS NOT NULL
          ) s;

        NEW.params_search_text := params_text;

        NEW.search_vector :=
          setweight(to_tsvector('jiebacfg', COALESCE(NEW.name, '')), 'A') ||
          setweight(
            to_tsvector(
              'jiebacfg',
              trim(COALESCE(NEW.brand, '') || ' ' || COALESCE(NEW.model, ''))
            ),
            'B'
          ) ||
          setweight(to_tsvector('jiebacfg', COALESCE(params_text, '')), 'D');

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ 完成');

    console.log('4️⃣ 挂载触发器...');
    await client.query(`
      DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
      CREATE TRIGGER products_search_vector_trigger
        BEFORE INSERT OR UPDATE OF name, brand, model, params ON products
        FOR EACH ROW
        EXECUTE FUNCTION products_search_vector_update();
    `);
    console.log('   ✅ 完成');

    console.log('5️⃣ 回填存量数据（触发器刷新 params_search_text + search_vector）...');
    const updateResult = await client.query(`
      UPDATE products SET name = name;
    `);
    console.log(`   ✅ 更新了 ${updateResult.rowCount} 条记录`);

    console.log('6️⃣ 确保 GIN 索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_search_vector
      ON products USING gin (search_vector);
    `);
    console.log('   ✅ 完成');

    console.log('\n📝 抽样验证:');
    const sample = await client.query(`
      SELECT id, name,
             left(COALESCE(params_search_text, ''), 80) AS params_text_preview,
             length(COALESCE(params_search_text, '')) AS params_text_len
      FROM products
      WHERE deleted_at IS NULL AND params_search_text IS NOT NULL
      LIMIT 3
    `);
    for (const row of sample.rows) {
      console.log(`   #${row.id} ${row.name}`);
      console.log(`     params_search_text(${row.params_text_len}): ${row.params_text_preview}...`);
    }

    console.log('\n🎉 全文搜索迁移完成!');
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
