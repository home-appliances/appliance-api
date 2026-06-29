-- =====================================================
-- 数据库优化迁移脚本
-- 解决：图片冗余、search_logs冲突、params结构、分类表
-- =====================================================

-- =====================================================
-- 1. 创建产品分类表 (categories)
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 分类编码（英文，用于程序逻辑）
    code TEXT UNIQUE NOT NULL,
    -- 分类中文名
    name TEXT NOT NULL,
    -- 父分类ID（支持层级：大家电 > 厨电 > 冰箱）
    parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    -- 排序权重
    sort_order INTEGER DEFAULT 0,
    -- 是否启用
    is_active BOOLEAN DEFAULT true,
    -- 创建时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 分类表索引
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories (code);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories (parent_id);

-- 插入默认分类（家电类型）
INSERT INTO categories (code, name, sort_order) VALUES
    ('icebox', '冰箱', 1),
    ('air_condition', '空调', 2),
    ('washer', '洗衣机', 3),
    ('gas_water', '燃气热水器', 4),
    ('central_water', '中央热水器', 5),
    ('heater', '取暖器', 6),
    ('lcd_tv', '液晶电视', 7),
    ('rice_cooker', '电饭煲', 8),
    ('dishwasher', '洗碗机', 9),
    ('washer_dryer', '洗烘一体机', 10),
    ('freezer', '冷柜', 11)
ON CONFLICT (code) DO NOTHING;

-- 插入子分类示例
INSERT INTO categories (code, name, parent_id, sort_order)
SELECT 'icebox_single', '单门冰箱', id, 1 FROM categories WHERE code = 'icebox'
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (code, name, parent_id, sort_order)
SELECT 'icebox_double', '双门冰箱', id, 2 FROM categories WHERE code = 'icebox'
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (code, name, parent_id, sort_order)
SELECT 'icebox_multi', '多门冰箱', id, 3 FROM categories WHERE code = 'icebox'
ON CONFLICT (code) DO NOTHING;


-- =====================================================
-- 2. 修复 search_logs 表冲突
-- =====================================================

-- 先备份现有数据（如果表已存在）
CREATE TABLE IF NOT EXISTS search_logs_backup AS
SELECT * FROM search_logs WHERE 1=0;

-- 如果原表有数据，备份它
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_logs') THEN
        INSERT INTO search_logs_backup SELECT * FROM search_logs;
    END IF;
END $$;

-- 删除旧表（如果存在）
DROP TABLE IF EXISTS search_logs CASCADE;

-- 重建 search_logs 表（包含完整字段）
CREATE TABLE search_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    keyword TEXT NOT NULL,
    search_count INTEGER NOT NULL DEFAULT 1,
    last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 添加唯一约束
    CONSTRAINT search_logs_keyword_unique UNIQUE (keyword)
);

-- 恢复备份数据
INSERT INTO search_logs (keyword, search_count, last_searched_at, created_at)
SELECT
    keyword,
    COALESCE(search_count, 1),
    COALESCE(last_searched_at, created_at),
    created_at
FROM search_logs_backup
ON CONFLICT (keyword) DO UPDATE SET
    search_count = EXCLUDED.search_count,
    last_searched_at = EXCLUDED.last_searched_at;

-- 删除备份表
DROP TABLE IF EXISTS search_logs_backup;

-- 重建索引
CREATE INDEX IF NOT EXISTS idx_search_logs_count ON search_logs (search_count DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs (created_at DESC);

-- 重建 log_search 函数
CREATE OR REPLACE FUNCTION log_search(p_keyword TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO search_logs (keyword, search_count, last_searched_at)
    VALUES (p_keyword, 1, NOW())
    ON CONFLICT (keyword)
    DO UPDATE SET
        search_count = search_logs.search_count + 1,
        last_searched_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 3. 优化 products 表：统一图片存储 + 添加分类外键
-- =====================================================

-- 3.1 添加 category_id 外键（关联分类表）
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES categories(id);

-- 3.2 回填 category_id（根据现有 category 字段）
UPDATE products p
SET category_id = c.id
FROM categories c
WHERE p.category = c.code
AND p.category_id IS NULL;

-- 3.3 添加索引
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);

-- 3.4 标记废弃字段（不立即删除，给代码迁移时间）
-- images TEXT[] 字段将不再使用，改为从 images 表查询
-- 可以在代码迁移完成后删除：
-- ALTER TABLE products DROP COLUMN IF EXISTS images;


-- =====================================================
-- 4. 优化 params JSONB：添加结构验证
-- =====================================================

-- 4.1 创建 JSONB 验证函数（检查必要字段）
CREATE OR REPLACE FUNCTION validate_product_params(params JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- 至少要有以下字段之一
    RETURN (
        params ? '型号' OR
        params ? '产品型号' OR
        params ? '能效等级' OR
        params ? '匹数' OR
        params ? '洗涤容量' OR
        params ? '总容积'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4.2 添加约束（新产品必须有基本参数）
-- 注意：对现有数据可能需要先清洗
-- ALTER TABLE products
-- ADD CONSTRAINT check_params_valid
-- CHECK (validate_product_params(params));

-- 4.3 为高频查询字段创建索引
CREATE INDEX IF NOT EXISTS idx_products_params_energy
ON products ((params->>'能效等级'));

CREATE INDEX IF NOT EXISTS idx_products_params_type
ON products ((params->>'产品类别'));

-- 空调相关索引
CREATE INDEX IF NOT EXISTS idx_products_params_ac_type
ON products ((params->>'空调类型'));

CREATE INDEX IF NOT EXISTS idx_products_params_ac_power
ON products ((params->>'匹数'));

-- 冰箱相关索引
CREATE INDEX IF NOT EXISTS idx_products_params_fridge_capacity
ON products ((params->>'总容积'));

-- 洗衣机相关索引
CREATE INDEX IF NOT EXISTS idx_products_params_washer_capacity
ON products ((params->>'洗涤容量'));


-- =====================================================
-- 5. 创建产品视图（简化查询）
-- =====================================================

CREATE OR REPLACE VIEW products_with_details AS
SELECT
    p.id,
    p.name,
    p.brand,
    p.model,
    p.category,
    c.name as category_name,
    p.params,
    p.price,
    p.rating,
    p.source_url,
    p.source_platform,
    p.pinyin,
    p.pinyin_initials,
    p.created_at,
    p.updated_at,
    -- 图片：优先从 images 表获取
    CASE
        WHEN p.image_id IS NOT NULL THEN
            (SELECT 'data:' || i.mime_type || ';base64,' || encode(i.image_data, 'base64')
             FROM images i WHERE i.id = p.image_id)
        WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN
            p.images[1]
        ELSE
            '/static/default_img.png'
    END as main_image,
    -- 图片数量
    COALESCE(
        (SELECT COUNT(*) FROM images WHERE id = p.image_id),
        0
    ) + COALESCE(array_length(p.images, 1), 0) as image_count
FROM products p
LEFT JOIN categories c ON p.category_id = c.id;


-- =====================================================
-- 6. 创建搜索优化函数
-- =====================================================

CREATE OR REPLACE FUNCTION search_products_fulltext(
    p_keyword TEXT,
    p_category TEXT DEFAULT NULL,
    p_page INTEGER DEFAULT 1,
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    brand TEXT,
    model TEXT,
    category TEXT,
    category_name TEXT,
    params JSONB,
    price NUMERIC,
    rating NUMERIC,
    main_image TEXT,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name,
        p.brand,
        p.model,
        p.category,
        c.name as category_name,
        p.params,
        p.price,
        p.rating,
        CASE
            WHEN p.image_id IS NOT NULL THEN
                (SELECT 'data:' || i.mime_type || ';base64,' || encode(i.image_data, 'base64')
                 FROM images i WHERE i.id = p.image_id)
            WHEN p.images IS NOT NULL AND array_length(p.images, 1) > 0 THEN
                p.images[1]
            ELSE
                '/static/default_img.png'
        END as main_image,
        ts_rank_cd(p.search_vector, to_tsquery('simple', p_keyword)) as rank
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE
        (p_category IS NULL OR p.category = p_category)
        AND (
            p.search_vector @@ to_tsquery('simple', p_keyword)
            OR p.name ILIKE '%' || p_keyword || '%'
            OR p.brand ILIKE '%' || p_keyword || '%'
            OR p.model ILIKE '%' || p_keyword || '%'
        )
    ORDER BY
        -- 品牌匹配优先
        CASE WHEN p.brand ILIKE p_keyword THEN 100 ELSE 0 END +
        -- 名称匹配次之
        CASE WHEN p.name ILIKE '%' || p_keyword || '%' THEN 50 ELSE 0 END +
        -- 全文搜索权重
        ts_rank_cd(p.search_vector, to_tsquery('simple', p_keyword)) * 100
    DESC
    LIMIT p_limit OFFSET (p_page - 1) * p_limit;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 7. 添加注释说明
-- =====================================================

COMMENT ON TABLE categories IS '产品分类表，支持层级结构';
COMMENT ON COLUMN categories.code IS '分类编码（英文），用于程序逻辑';
COMMENT ON COLUMN categories.parent_id IS '父分类ID，NULL表示顶级分类';

COMMENT ON TABLE products IS '家电产品主表';
COMMENT ON COLUMN products.category_id IS '关联分类表ID，替代原 category 字段';
COMMENT ON COLUMN products.params IS '产品参数JSONB，存储所有规格参数';
COMMENT ON COLUMN products.image_id IS '关联图片表ID，存储主图二进制数据';

COMMENT ON TABLE images IS '产品图片表，存储图片二进制数据';
COMMENT ON TABLE search_logs IS '搜索日志表，记录用户搜索行为';


-- =====================================================
-- 8. 验证迁移结果
-- =====================================================

DO $$
DECLARE
    product_count INTEGER;
    category_count INTEGER;
    image_count INTEGER;
    search_log_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO product_count FROM products;
    SELECT COUNT(*) INTO category_count FROM categories;
    SELECT COUNT(*) INTO image_count FROM images;
    SELECT COUNT(*) INTO search_log_count FROM search_logs;

    RAISE NOTICE '=== 迁移完成 ===';
    RAISE NOTICE '产品数量: %', product_count;
    RAISE NOTICE '分类数量: %', category_count;
    RAISE NOTICE '图片数量: %', image_count;
    RAISE NOTICE '搜索日志: %', search_log_count;
    RAISE NOTICE '================';
END $$;
