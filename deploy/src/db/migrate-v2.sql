-- =====================================================
-- 产品表重构迁移脚本 v2
-- 目标：通用全品类家电产品库
-- =====================================================

-- 临时关闭外键检查
SET session_replication_role = replica;

-- =====================================================
-- 1. 删除旧表（保留 categories 和基础表）
-- =====================================================
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS category_params CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS images CASCADE;

-- =====================================================
-- 2. categories 表（增强版）
-- =====================================================
DROP TABLE IF EXISTS categories CASCADE;
CREATE TABLE categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,              -- 分类编码（英文）
    name TEXT NOT NULL,                     -- 分类中文名
    display_name TEXT,                      -- 展示名（用于前端）
    icon TEXT,                              -- 图标（emoji 或 icon name）
    parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_code ON categories (code);
CREATE INDEX idx_categories_parent ON categories (parent_id);

-- 插入默认分类
INSERT INTO categories (code, name, display_name, icon, sort_order) VALUES
    ('air_condition', '空调', '空调', '❄️', 1),
    ('icebox', '冰箱', '冰箱', '🧊', 2),
    ('washer', '洗衣机', '洗衣机', '👕', 3),
    ('gas_water', '燃气热水器', '燃气热水器', '🔥', 4),
    ('central_water', '中央热水器', '中央热水器', '♨️', 5),
    ('heater', '取暖器', '取暖器', '🌡️', 6),
    ('lcd_tv', '液晶电视', '电视', '📺', 7),
    ('rice_cooker', '电饭煲', '电饭煲', '🍚', 8),
    ('dishwasher', '洗碗机', '洗碗机', '🍽️', 9),
    ('washer_dryer', '洗烘一体机', '洗烘一体机', '🌀', 10),
    ('freezer', '冷柜', '冷柜', '❄️', 11),
    ('range_hood', '油烟机', '油烟机', '💨', 12),
    ('gas_stove', '燃气灶', '燃气灶', '🔥', 13),
    ('microwave', '微波炉', '微波炉', '📡', 14),
    ('oven', '烤箱', '烤箱', '🥐', 15),
    ('air_fryer', '空气炸锅', '空气炸锅', '🍟', 16)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- 3. products 表（通用产品表）
-- =====================================================
CREATE TABLE products (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- 基本信息（所有品类通用）
    name TEXT NOT NULL,                     -- 产品名称
    brand TEXT NOT NULL,                    -- 品牌（英文：gree, haier, midea）
    model TEXT,                             -- 型号
    category_id BIGINT REFERENCES categories(id),  -- 分类ID

    -- 价格（允许为空）
    price NUMERIC(10,2),                    -- 价格
    original_price NUMERIC(10,2),           -- 原价（划线价）

    -- 评分（允许为空）
    rating NUMERIC(3,1),                    -- 评分
    review_count INTEGER DEFAULT 0,         -- 评价数

    -- 品类特有参数（灵活存储）
    params JSONB NOT NULL DEFAULT '{}',

    -- 搜索优化
    search_vector tsvector,                 -- 全文搜索向量
    pinyin TEXT,                            -- 拼音
    pinyin_initials TEXT,                   -- 拼音首字母

    -- 数据来源
    source_url TEXT UNIQUE,                 -- 爬取来源URL
    source_platform TEXT DEFAULT 'pconline', -- 来源平台

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 软删除
    deleted_at TIMESTAMPTZ,
    deleted_by TEXT
);

-- 索引
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_products_source_url ON products(source_url);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_params_gin ON products USING gin (params);
CREATE INDEX idx_products_search_vector ON products USING gin(search_vector);

-- 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 全文搜索触发器
CREATE OR REPLACE FUNCTION products_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.brand, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.model, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(
            jsonb_path_query_array(NEW.params, '$.*')::text, ''
        )), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tsvectorupdate
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_search_vector_update();

-- =====================================================
-- 4. product_images 表（产品图片）
-- =====================================================
CREATE TABLE product_images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE NOT NULL,

    -- 图片信息
    image_url TEXT,                         -- 图片URL（OSS或外部链接）

    -- 图片分类
    image_type TEXT NOT NULL DEFAULT 'main', -- 类型：main(主图) / display(展示图) / detail(细节图) / scene(场景图)

    -- 排序
    sort_order INTEGER DEFAULT 0,

    -- 时间戳
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 唯一约束
    UNIQUE(product_id, image_type, sort_order)
);

-- 索引
CREATE INDEX idx_product_images_product ON product_images(product_id);
CREATE INDEX idx_product_images_type ON product_images(product_id, image_type);

-- =====================================================
-- 5. category_params 表（品类参数规范）
-- =====================================================
CREATE TABLE category_params (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id BIGINT REFERENCES categories(id) NOT NULL,
    param_key TEXT NOT NULL,                -- 参数名（如"匹数"）
    display_name TEXT NOT NULL,             -- 显示名（如"匹数"）
    icon TEXT,                              -- 图标
    param_type TEXT NOT NULL DEFAULT 'text', -- 值类型：text/number/enum/boolean
    is_core BOOLEAN DEFAULT false,          -- 是否核心参数（搜索列表展示）
    is_filter BOOLEAN DEFAULT false,        -- 是否可筛选
    is_sortable BOOLEAN DEFAULT false,      -- 是否可排序
    enum_values JSONB,                      -- 枚举值（param_type='enum' 时使用）
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(category_id, param_key)
);

-- 索引
CREATE INDEX idx_category_params_category ON category_params(category_id);

-- =====================================================
-- 6. 保留其他辅助表
-- =====================================================

-- 管理员表（如果不存在）
CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'admin',
    status TEXT DEFAULT 'active',
    avatar TEXT,
    remark TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 爬虫任务表
CREATE TABLE IF NOT EXISTS crawler_tasks (
    id BIGSERIAL PRIMARY KEY,
    category TEXT,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    total_products INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 搜索日志表
CREATE TABLE IF NOT EXISTS search_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    keyword TEXT NOT NULL,
    search_count INTEGER NOT NULL DEFAULT 1,
    last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT search_logs_keyword_unique UNIQUE (keyword)
);

CREATE INDEX IF NOT EXISTS idx_search_logs_count ON search_logs (search_count DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs (created_at DESC);

-- 搜索日志函数
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

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES admins(id),
    operator TEXT NOT NULL,
    ip TEXT,
    type TEXT NOT NULL,
    target TEXT,
    result TEXT DEFAULT 'success',
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs (created_at DESC);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认设置
INSERT INTO system_settings (key, value) VALUES
    ('basic', '{"systemName":"家电搜索后台","language":"zh-CN","timezone":"Asia/Shanghai"}'),
    ('security', '{"pwdMinLength":8,"sessionTimeout":60}'),
    ('data', '{"defaultPageSize":20}')
ON CONFLICT (key) DO NOTHING;

-- 恢复外键检查
SET session_replication_role = DEFAULT;

-- =====================================================
-- 完成
-- =====================================================
SELECT 'Migration v2 completed' as result;
