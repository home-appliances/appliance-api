import { Hono } from 'hono';
import { pool } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';

const logs = new Hono();

logs.use('/api/admin/logs/*', authMiddleware);
logs.use('/api/admin/logs', authMiddleware);

/**
 * 获取操作日志列表
 * GET /api/admin/logs?page=1&limit=20&type=&operator=
 */
logs.get('/api/admin/logs', async (c) => {
  try {
    const admin = (c as any).get('admin');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const type = c.req.query('type') || '';
    const operator = c.req.query('operator') || '';

    let query = `SELECT l.id, l.admin_id, l.operator, l.ip, l.type, l.target, l.result, l.detail, l.created_at
                 FROM operation_logs l WHERE 1=1`;
    let countQuery = 'SELECT COUNT(*) FROM operation_logs l WHERE 1=1';
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    // 普通管理员只能看自己的日志
    if (admin.role !== 'super_admin') {
      query += ` AND l.admin_id = $${paramIndex}`;
      countQuery += ` AND l.admin_id = $${countParamIndex}`;
      params.push(admin.id);
      countParams.push(admin.id);
      paramIndex++;
      countParamIndex++;
    } else if (operator) {
      query += ` AND l.operator ILIKE $${paramIndex}`;
      countQuery += ` AND l.operator ILIKE $${countParamIndex}`;
      params.push(`%${operator}%`);
      countParams.push(`%${operator}%`);
      paramIndex++;
      countParamIndex++;
    }

    if (type) {
      query += ` AND l.type = $${paramIndex}`;
      countQuery += ` AND l.type = $${countParamIndex}`;
      params.push(type);
      countParams.push(type);
      paramIndex++;
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY l.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    return c.json({
      code: 0,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    return c.json({ code: 500, message: '获取操作日志失败' }, 500);
  }
});

/**
 * 记录操作日志（内部调用）
 * POST /api/admin/logs
 */
logs.post('/api/admin/logs', async (c) => {
  try {
    const { admin_id, operator, ip, type, target, result: res, detail } = await c.req.json();

    await pool.query(
      `INSERT INTO operation_logs (admin_id, operator, ip, type, target, result, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [admin_id, operator, ip, type, target, res || 'success', detail || null]
    );

    return c.json({ code: 0, message: '日志记录成功' });
  } catch (error) {
    console.error('记录日志失败:', error);
    return c.json({ code: 500, message: '记录日志失败' }, 500);
  }
});

export default logs;
