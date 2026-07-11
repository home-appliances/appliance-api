import { Hono } from 'hono';
import { authMiddleware, superAdminMiddleware } from '../../middleware/auth.js';
import * as queries from '../../db/queries.js';

const logs = new Hono();

logs.use('/api/admin/logs/*', authMiddleware);
logs.use('/api/admin/logs', authMiddleware);

/**
 * 获取操作日志列表
 * GET /api/admin/logs?page=1&limit=20
 */
logs.get('/api/admin/logs', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');

    const result = await queries.getOperationLogs(page, limit);

    return c.json({
      code: 0,
      data: {
        list: result.logs,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      },
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    return c.json({ code: 500, message: '获取操作日志失败' }, 500);
  }
});

/**
 * 删除单条日志（仅超级管理员）
 * DELETE /api/admin/logs/:id
 */
logs.delete('/api/admin/logs/:id', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const result = await queries.deleteOperationLog(id);

    if (!result) {
      return c.json({ code: 404, message: '日志不存在' }, 404);
    }

    return c.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('删除日志失败:', error);
    return c.json({ code: 500, message: '删除日志失败' }, 500);
  }
});

/**
 * 清空所有日志（仅超级管理员）
 * DELETE /api/admin/logs
 */
logs.delete('/api/admin/logs', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    await queries.clearOperationLogs();

    return c.json({ code: 0, message: '日志已清空' });
  } catch (error) {
    console.error('清空日志失败:', error);
    return c.json({ code: 500, message: '清空日志失败' }, 500);
  }
});

export default logs;
