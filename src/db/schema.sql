-- =====================================================
-- 家电数据爬取 - PostgreSQL 数据库设计
-- 遵循 Supabase Postgres Best Practices
-- =====================================================

-- 启用必要的扩展
-- pg_uuidv7: 如果需要 UUIDv7 主键（本设计使用 bigint identity，无需启用）

-- =====================================================
-- 1. 图片表 (images)
-- 存储电器产品图片，BYTEA 直接存数据库
-- 遵循: schema-primary-keys, schema-data-types, schema-lowercase-identifiers
-- =====================================================
CREATE TABLE IF NOT EXISTS images (
    -- 主键：bigint identity，SQL 标准，比 serial 更优
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- 图片二进制数据
    image_data BYTEA NOT NULL,

    -- MIME 类型：image/jpeg, image/png, image/webp 等
    mime_type TEXT NOT NULL,

    -- 图片文件大小（字节），便于前端判断是否加载
    file_size INTEGER,

    -- 图片宽高，便于前端布局
    width INTEGER,
    height INTEGER,

    -- 原始图片 URL，用于去重
    source_url TEXT UNIQUE,

    -- 创建时间，带时区
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 图片表索引
-- 按 MIME 类型查询（如只查 JPEG）
CREATE INDEX IF NOT EXISTS idx_images_mime_type ON images (mime_type);

-- 按创建时间排序（如最新上传的图片）
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images (created_at DESC);

-- 按来源 URL 查询（图片去重）
CREATE INDEX IF NOT EXISTS idx_images_source_url ON images (source_url);


-- =====================================================
-- 2. 电器产品表 (products)
-- 存储爬取的电器数据，参数用 JSONB 存储
-- 遵循: schema-primary-keys, schema-data-types, schema-lowercase-identifiers
-- =====================================================
CREATE TABLE IF NOT EXISTS products (
    -- 主键：bigint identity，支持最多 9 quintillion 条记录
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- 产品名称
    name TEXT NOT NULL,

    -- 品牌
    brand TEXT NOT NULL,

    -- 产品类别（icebox, air_condition, washer, gas_water 等）
    category TEXT,

    -- 产品型号
    model TEXT,

    -- 所有参数用 JSONB 存储，灵活且可查询
    -- 示例: {"power": "1.5匹", "energy_level": "一级能效", "voltage": "220V"}
    params JSONB NOT NULL DEFAULT '{}',

    -- 产品价格
    price NUMERIC(10,2),

    -- 产品评分
    rating NUMERIC(3,1),

    -- 产品图片 URL 数组
    images TEXT[],

    -- 关联图片表（一个产品对应一张主图）
    image_id BIGINT REFERENCES images(id) ON DELETE SET NULL,

    -- 产品来源 URL（爬取的原始链接）
    source_url TEXT UNIQUE,

    -- 数据来源平台
    source_platform TEXT DEFAULT 'pconline',

    -- 最后爬取时间
    last_crawled_at TIMESTAMPTZ DEFAULT NOW(),

    -- 爬取次数
    crawl_count INTEGER DEFAULT 1,

    -- 创建时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 更新时间
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- 产品表索引设计
-- 遵循: advanced-jsonb-indexing, query-index-types
-- =====================================================

-- 1. JSONB GIN 索引：支持高效 JSONB 查询
CREATE INDEX IF NOT EXISTS idx_products_params_gin ON products USING gin (params);

-- 2. 品牌索引：按品牌筛选产品
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);

-- 3. 来源 URL 索引：产品去重
CREATE INDEX IF NOT EXISTS idx_products_source_url ON products (source_url);

-- 4. 创建时间索引：按时间排序
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);

-- 5. 全文搜索索引（可选）：按产品名称搜索
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING gin (to_tsvector('simple', name));

-- 6. JSONB 特定字段索引：高频查询字段单独建索引
-- 示例：按能效等级查询
-- CREATE INDEX IF NOT EXISTS idx_products_energy_level ON products ((params->>'energy_level'));

-- 7. 品牌+类别复合索引：组合筛选更高效
-- CREATE INDEX IF NOT EXISTS idx_products_brand_category ON products (brand, (params->>'category'));


-- =====================================================
-- 3. 自动更新 updated_at 触发器
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 products 表创建触发器
DROP TRIGGER IF EXISTS set_products_updated_at ON products;
CREATE TRIGGER set_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- 4. 约束安全添加（遵循 schema-constraints）
-- =====================================================

-- 添加唯一约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_source_url_unique'
    AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_source_url_unique UNIQUE (source_url);
  END IF;
END $$;

-- 添加图片表唯一约束
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'images_source_url_unique'
    AND conrelid = 'public.images'::regclass
  ) THEN
    ALTER TABLE images
    ADD CONSTRAINT images_source_url_unique UNIQUE (source_url);
  END IF;
END $$;
