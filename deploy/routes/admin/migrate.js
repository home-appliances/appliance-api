"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../../db/index.js");
const migrate = new hono_1.Hono();
// 临时迁移接口，执行后删除
migrate.post('/api/admin/migrate-v2', async (c) => {
    try {
        const sql = `
-- 扩展 admins 表
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='name') THEN
        ALTER TABLE admins ADD COLUMN name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='email') THEN
        ALTER TABLE admins ADD COLUMN email TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='phone') THEN
        ALTER TABLE admins ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='role') THEN
        ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'admin';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='status') THEN
        ALTER TABLE admins ADD COLUMN status TEXT DEFAULT 'active';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='avatar') THEN
        ALTER TABLE admins ADD COLUMN avatar TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='remark') THEN
        ALTER TABLE admins ADD COLUMN remark TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='updated_at') THEN
        ALTER TABLE admins ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

UPDATE admins SET
    name = COALESCE(name, '系统管理员'),
    email = COALESCE(email, 'admin@appliance.com'),
    role = COALESCE(role, 'super_admin'),
    status = COALESCE(status, 'active'),
    avatar = COALESCE(avatar, 'SA')
WHERE username = 'admin';

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
CREATE INDEX IF NOT EXISTS idx_operation_logs_admin_id ON operation_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs (type);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO system_settings (key, value) VALUES
    ('basic', '{"systemName":"Appliance Admin","language":"zh-CN","timezone":"Asia/Shanghai","dateFormat":"YYYY-MM-DD HH:mm:ss"}'),
    ('security', '{"pwdMinLength":8,"pwdComplexity":true,"pwdExpiry":90,"loginFailLock":5,"lockDuration":30,"sessionTimeout":60,"maxConcurrent":3}'),
    ('data', '{"defaultPageSize":20,"exportMaxLimit":10000,"recycleCleanDays":30,"backupMode":"manual"}'),
    ('notification', '{"smtpHost":"","smtpPort":465,"alertEnabled":true,"alertMethod":"email"}')
ON CONFLICT (key) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_at') THEN
        ALTER TABLE products ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_by') THEN
        ALTER TABLE products ADD COLUMN deleted_by TEXT;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products (deleted_at) WHERE deleted_at IS NOT NULL;
`;
        await index_js_1.pool.query(sql);
        return c.json({ success: true, message: 'v2 迁移完成' });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
exports.default = migrate;
