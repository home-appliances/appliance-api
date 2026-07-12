"use strict";
/**
 * 全文搜索迁移脚本
 * 为 products 表添加 search_vector 字段（pg_jieba 分词）
 */
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./index.js");
async function migrate() {
    const client = await index_js_1.pool.connect();
    try {
        console.log('🔧 开始全文搜索迁移...\n');
        // 0. 创建 pg_jieba 扩展（如果不存在）
        console.log('0️⃣ 检查 pg_jieba 扩展...');
        await client.query(`CREATE EXTENSION IF NOT EXISTS pg_jieba;`);
        console.log('   ✅ 完成');
        // 1. 检查 jiebacfg 配置（pg_jieba 自带）
        console.log('1️⃣ 检查 jiebacfg 分词配置...');
        const cfgResult = await client.query(`SELECT cfgname FROM pg_ts_config WHERE cfgname = 'jiebacfg';`);
        if (cfgResult.rows.length > 0) {
            console.log('   ✅ jiebacfg 配置已存在');
        }
        else {
            console.log('   ⚠️ jiebacfg 配置不存在，尝试创建...');
            await client.query(`CREATE TEXT SEARCH CONFIGURATION jiebacfg (PARSER = jieba);`);
        }
        // 2. 添加 search_vector 字段
        console.log('2️⃣ 添加 search_vector 字段...');
        await client.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;
    `);
        console.log('   ✅ 完成');
        // 3. 创建触发器函数
        console.log('3️⃣ 创建触发器函数...');
        await client.query(`
      CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          to_tsvector('jiebacfg', COALESCE(NEW.name, '')) ||
          to_tsvector('jiebacfg', COALESCE(NEW.brand, '')) ||
          to_tsvector('jiebacfg', COALESCE(NEW.model, '')) ||
          to_tsvector('jiebacfg', COALESCE(NEW.params::text, ''));
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
        console.log('   ✅ 完成');
        // 4. 创建触发器
        console.log('4️⃣ 创建触发器...');
        await client.query(`
      DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
      CREATE TRIGGER products_search_vector_trigger
        BEFORE INSERT OR UPDATE ON products
        FOR EACH ROW
        EXECUTE FUNCTION products_search_vector_update();
    `);
        console.log('   ✅ 完成');
        // 5. 更新现有数据
        console.log('5️⃣ 更新现有数据的 search_vector...');
        const updateResult = await client.query(`
      UPDATE products SET search_vector =
        to_tsvector('jiebacfg', COALESCE(name, '')) ||
        to_tsvector('jiebacfg', COALESCE(brand, '')) ||
        to_tsvector('jiebacfg', COALESCE(model, '')) ||
        to_tsvector('jiebacfg', COALESCE(params::text, ''));
    `);
        console.log(`   ✅ 更新了 ${updateResult.rowCount} 条记录`);
        // 6. 创建 GIN 索引
        console.log('6️⃣ 创建 GIN 索引...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_products_search_vector
      ON products USING gin (search_vector);
    `);
        console.log('   ✅ 完成');
        // 7. 验证分词效果
        console.log('\n📝 验证分词效果:');
        const testResult = await client.query(`
      SELECT name, ts_debug('jiebacfg', name) as tokens
      FROM products LIMIT 3;
    `);
        for (const row of testResult.rows) {
            console.log(`\n   "${row.name}":`);
            const tokens = Array.isArray(row.tokens) ? row.tokens : [row.tokens];
            for (const token of tokens.slice(0, 5)) {
                if (token && typeof token === 'object') {
                    console.log(`     ${token.token} → ${token.dicts[0] || '无匹配'}`);
                }
            }
        }
        console.log('\n🎉 全文搜索迁移完成!');
    }
    catch (error) {
        console.error('❌ 迁移失败:', error);
        throw error;
    }
    finally {
        client.release();
        await index_js_1.pool.end();
    }
}
migrate().catch(e => {
    console.error(e);
    process.exit(1);
});
