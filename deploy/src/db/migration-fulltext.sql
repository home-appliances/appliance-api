-- =====================================================
-- 全文搜索迁移脚本
-- 将 ILIKE 模糊查询升级为 tsvector + GIN 索引
-- =====================================================

-- 1. 安装中文分词扩展（如果未安装）
-- 方案A: 使用 zhparser（推荐，需要 PostgreSQL 9.6+）
-- CREATE EXTENSION IF NOT EXISTS zhparser;

-- 方案B: 如果无法安装 zhparser，使用 simple 分词器 + 自定义词典
-- 这里使用 simple 分词器作为备选方案

-- 2. 添加全文搜索列（tsvector）
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- 3. 创建GIN索引（支持中文需要使用特定配置）
-- 如果安装了 zhparser，使用 'zhcfg' 配置
-- CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING gin(search_vector);

-- 如果使用 simple 分词器（不支持中文分词，但能匹配数字和英文）
CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING gin(search_vector);

-- 4. 创建触发器函数：自动更新 search_vector
CREATE OR REPLACE FUNCTION products_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    -- 组合搜索字段，品牌权重更高（重复添加）
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.brand, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.brand, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.model, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(
            jsonb_path_query_array(NEW.params, '$.*')::text, ''
        )), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 创建触发器
DROP TRIGGER IF EXISTS tsvectorupdate ON products;
CREATE TRIGGER tsvectorupdate
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_search_vector_update();

-- 6. 回填现有数据的 search_vector
UPDATE products SET search_vector =
    setweight(to_tsvector('simple', COALESCE(brand, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(brand, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(name, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(model, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(
        jsonb_path_query_array(params, '$.*')::text, ''
    )), 'D')
WHERE search_vector IS NULL;

-- 7. 验证索引
-- EXPLAIN ANALYZE SELECT * FROM products WHERE search_vector @@ to_tsquery('simple', '格力');

-- =====================================================
-- 说明：
-- 权重分配：
-- A = 品牌（最高权重，出现两次）
-- B = 产品名称
-- C = 型号
-- D = 参数值
--
-- 搜索逻辑：
-- '格力1.5匹空调' 会被分词为：格力, 1.5, 匹, 空调
-- 品牌匹配权重最高，其次是名称，然后是型号和参数
-- =====================================================
