/**
 * 数据库迁移接口
 *
 * POST /api/admin/db/migrate
 *   - 认证：X-Migrate-Secret 请求头（值 = MIGRATE_SECRET 环境变量）
 *   - MIGRATE_SECRET 是高熵随机值（32 字节 hex），仅 GitHub Actions 持有
 *   - 调用 migrateAuto 走 VPC 内网执行未跑的 migration
 *   - 返回执行结果
 *
 * 供 GitHub Actions 部署后自动调用，无需管理员登录。
 */

import { Hono } from 'hono';
import { migrateAuto } from '../../db/migrate-auto.js';

const migrate = new Hono();

// 迁移密钥校验中间件
const migrateSecretMiddleware = async (c: any, next: any) => {
  const secret = c.req.header('X-Migrate-Secret');
  const expected = process.env.MIGRATE_SECRET;

  if (!expected) {
    return c.json({ code: 500, message: '服务器未配置 MIGRATE_SECRET' }, 500);
  }
  if (secret !== expected) {
    return c.json({ code: 403, message: '迁移密钥无效' }, 403);
  }
  await next();
};

// POST /api/admin/db/migrate - 执行数据库迁移
migrate.post(
  '/api/admin/db/migrate',
  migrateSecretMiddleware,
  async (c) => {
    try {
      const result = await migrateAuto();

      if (result.error && result.executed.length === 0) {
        return c.json({
          code: 0,
          message: result.error,
          executed: result.executed,
          skipped: result.skipped,
        });
      }

      return c.json({
        code: 0,
        message: result.executed.length > 0
          ? `迁移完成，执行了 ${result.executed.length} 个`
          : '无需迁移，所有 migration 已是最新',
        executed: result.executed,
        skipped: result.skipped,
      });
    } catch (error: any) {
      console.error('[migrate] 迁移失败:', error);
      return c.json({
        code: 500,
        message: '迁移失败: ' + (error?.message || String(error)),
        error: error?.message || String(error),
      }, 500);
    }
  }
);

export default migrate;
