-- =====================================================
-- 管理后台相关表
-- =====================================================

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
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

-- 搜索日志表（如果不存在）
CREATE TABLE IF NOT EXISTS search_logs (
    id BIGSERIAL PRIMARY KEY,
    keyword TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawler_tasks_status ON crawler_tasks (status);
CREATE INDEX IF NOT EXISTS idx_crawler_tasks_created_at ON crawler_tasks (created_at DESC);

-- 插入默认管理员账号 (admin / admin123)
-- 密码使用 bcrypt 哈希：$2b$10$KxQz5Qz5Qz5Qz5Qz5Qz5Qe
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2b$10$KxQz5Qz5Qz5Qz5Qz5Qz5Qe')
ON CONFLICT (username) DO NOTHING;
