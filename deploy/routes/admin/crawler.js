"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../../db/index.js");
const auth_js_1 = require("../../middleware/auth.js");
const crawler = new hono_1.Hono();
// 所有爬虫路由都需要认证
crawler.use('/api/admin/crawler/*', auth_js_1.authMiddleware);
/**
 * 获取爬虫任务列表
 * GET /api/admin/crawler/tasks
 */
crawler.get('/api/admin/crawler/tasks', async (c) => {
    try {
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const status = c.req.query('status') || '';
        const offset = (page - 1) * limit;
        const params = [];
        let whereClause = '';
        if (status) {
            whereClause = 'WHERE status = $1';
            params.push(status);
        }
        // 查询总数
        const countResult = await index_js_1.pool.query(`SELECT COUNT(*) FROM crawler_tasks ${whereClause}`, params);
        const total = parseInt(countResult.rows[0].count);
        // 查询数据
        const dataResult = await index_js_1.pool.query(`SELECT * FROM crawler_tasks
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
        return c.json({
            code: 0,
            data: {
                list: dataResult.rows,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    }
    catch (error) {
        console.error('获取爬虫任务列表失败:', error);
        return c.json({ code: 500, message: '获取任务列表失败' }, 500);
    }
});
/**
 * 获取任务详情
 * GET /api/admin/crawler/tasks/:id
 */
crawler.get('/api/admin/crawler/tasks/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const result = await index_js_1.pool.query('SELECT * FROM crawler_tasks WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '任务不存在' }, 404);
        }
        return c.json({ code: 0, data: result.rows[0] });
    }
    catch (error) {
        console.error('获取任务详情失败:', error);
        return c.json({ code: 500, message: '获取任务详情失败' }, 500);
    }
});
/**
 * 启动爬虫任务
 * POST /api/admin/crawler/start
 */
crawler.post('/api/admin/crawler/start', async (c) => {
    try {
        const { category } = await c.req.json();
        // 检查是否有正在运行的任务
        const runningTask = await index_js_1.pool.query("SELECT id FROM crawler_tasks WHERE status = 'running' LIMIT 1");
        if (runningTask.rows.length > 0) {
            return c.json({ code: 400, message: '已有任务正在运行，请等待完成' }, 400);
        }
        // 创建新任务
        const result = await index_js_1.pool.query(`INSERT INTO crawler_tasks (category, status, started_at)
       VALUES ($1, 'running', NOW())
       RETURNING *`, [category || 'all']);
        const task = result.rows[0];
        // TODO: 实际启动爬虫进程
        // 这里可以使用 child_process 启动爬虫脚本
        // spawn('tsx', ['src/crawler/index.ts', '--task-id', task.id]);
        console.log(`爬虫任务已启动: ${task.id}, 品类: ${category || 'all'}`);
        return c.json({
            code: 0,
            data: task,
            message: '任务已启动',
        });
    }
    catch (error) {
        console.error('启动爬虫任务失败:', error);
        return c.json({ code: 500, message: '启动任务失败' }, 500);
    }
});
/**
 * 停止爬虫任务
 * POST /api/admin/crawler/tasks/:id/stop
 */
crawler.post('/api/admin/crawler/tasks/:id/stop', async (c) => {
    try {
        const id = c.req.param('id');
        const result = await index_js_1.pool.query(`UPDATE crawler_tasks
       SET status = 'failed', error_message = '手动停止', completed_at = NOW()
       WHERE id = $1 AND status = 'running'
       RETURNING *`, [id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '任务不存在或未在运行' }, 404);
        }
        // TODO: 实际停止爬虫进程
        return c.json({ code: 0, message: '任务已停止' });
    }
    catch (error) {
        console.error('停止任务失败:', error);
        return c.json({ code: 500, message: '停止任务失败' }, 500);
    }
});
/**
 * 删除任务
 * DELETE /api/admin/crawler/tasks/:id
 */
crawler.delete('/api/admin/crawler/tasks/:id', async (c) => {
    try {
        const id = c.req.param('id');
        // 只能删除已完成或失败的任务
        const result = await index_js_1.pool.query(`DELETE FROM crawler_tasks
       WHERE id = $1 AND status IN ('completed', 'failed')
       RETURNING id`, [id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '任务不存在或正在运行中' }, 404);
        }
        return c.json({ code: 0, message: '删除成功' });
    }
    catch (error) {
        console.error('删除任务失败:', error);
        return c.json({ code: 500, message: '删除任务失败' }, 500);
    }
});
exports.default = crawler;
