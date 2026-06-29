-- =====================================================
-- 搜索体验优化迁移脚本
-- =====================================================

-- 1. 创建搜索日志表（记录搜索关键词，用于热门搜索）
CREATE TABLE IF NOT EXISTS search_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    keyword TEXT NOT NULL UNIQUE,
    search_count INTEGER NOT NULL DEFAULT 1,
    last_searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 搜索日志索引：按搜索次数排序
CREATE INDEX IF NOT EXISTS idx_search_logs_count ON search_logs (search_count DESC);

-- 2. products 表新增拼音列
ALTER TABLE products ADD COLUMN IF NOT EXISTS pinyin TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS pinyin_initials TEXT;

-- 拼音索引：支持 ILIKE 搜索
CREATE INDEX IF NOT EXISTS idx_products_pinyin ON products (pinyin);
CREATE INDEX IF NOT EXISTS idx_products_pinyin_initials ON products (pinyin_initials);

-- 3. 创建搜索日志插入/更新函数（upsert）
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
