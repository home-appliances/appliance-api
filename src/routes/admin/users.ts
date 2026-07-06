import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { pool } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';

const users = new Hono();

// 所有用户路由需要认证
users.use('/api/admin/users/*', authMiddleware);

/**
 * 获取用户列表
 * GET /api/admin/users?page=1&limit=10&search=&role=&status=
 */
users.get('/api/admin/users', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search') || '';
    const role = c.req.query('role') || '';
    const status = c.req.query('status') || '';

    let query = "SELECT id, username, name, email, phone, role, status, avatar, remark, created_at, last_login FROM admins WHERE status != 'deleted'";
    let countQuery = "SELECT COUNT(*) FROM admins WHERE status != 'deleted'";
    const params: any[] = [];
    const countParams: any[] = [];
    let paramIndex = 1;
    let countParamIndex = 1;

    if (search) {
      const searchClause = ` AND (username ILIKE $${paramIndex} OR name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`;
      query += searchClause;
      countQuery += searchClause.replace(/\$\d+/g, () => `$${countParamIndex++}`);
      params.push(`%${search}%`);
      countParams.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND role = $${paramIndex}`;
      countQuery += ` AND role = $${countParamIndex}`;
      params.push(role);
      countParams.push(role);
      paramIndex++;
      countParamIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      countQuery += ` AND status = $${countParamIndex}`;
      params.push(status);
      countParams.push(status);
      paramIndex++;
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    return c.json({
      code: 0,
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return c.json({ code: 500, message: '获取用户列表失败' }, 500);
  }
});

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
users.get('/api/admin/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const result = await pool.query(
      'SELECT id, username, name, email, phone, role, status, avatar, remark, created_at, last_login FROM admins WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0] });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    return c.json({ code: 500, message: '获取用户详情失败' }, 500);
  }
});

/**
 * 创建用户
 * POST /api/admin/users
 */
users.post('/api/admin/users', async (c) => {
  try {
    const { username, name, email, phone, password, role, status, remark } = await c.req.json();

    if (!username || !name || !password) {
      return c.json({ code: 400, message: '用户名、姓名和密码为必填项' }, 400);
    }

    // 检查用户名是否已存在（排除已删除的）
    const exists = await pool.query("SELECT id FROM admins WHERE username = $1 AND status != 'deleted'", [username]);
    if (exists.rows.length > 0) {
      return c.json({ code: 400, message: '用户名已存在' }, 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatar = name.slice(0, 2);

    const result = await pool.query(
      `INSERT INTO admins (username, name, email, phone, password_hash, role, status, avatar, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, username, name, email, phone, role, status, avatar, remark, created_at`,
      [username, name, email || null, phone || null, passwordHash, role || 'admin', status || 'active', avatar, remark || null]
    );

    return c.json({ code: 0, data: result.rows[0], message: '用户创建成功' });
  } catch (error) {
    console.error('创建用户失败:', error);
    return c.json({ code: 500, message: '创建用户失败' }, 500);
  }
});

/**
 * 编辑用户
 * PUT /api/admin/users/:id
 */
users.put('/api/admin/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { name, email, phone, password, role, status, remark } = body;

    // 动态构建 UPDATE 语句，只更新传入的字段
    const updates: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) { updates.push(`name = $${paramIndex}`); params.push(name); paramIndex++; }
    if (email !== undefined) { updates.push(`email = $${paramIndex}`); params.push(email || null); paramIndex++; }
    if (phone !== undefined) { updates.push(`phone = $${paramIndex}`); params.push(phone || null); paramIndex++; }
    if (role !== undefined) { updates.push(`role = $${paramIndex}`); params.push(role); paramIndex++; }
    if (status !== undefined) { updates.push(`status = $${paramIndex}`); params.push(status); paramIndex++; }
    if (remark !== undefined) { updates.push(`remark = $${paramIndex}`); params.push(remark || null); paramIndex++; }

    let query = `UPDATE admins SET ${updates.join(', ')}`;


    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += `, password_hash = $${paramIndex}`;
      params.push(hash);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex} RETURNING id, username, name, email, phone, role, status, avatar, remark, created_at, last_login`;
    params.push(id);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0], message: '用户更新成功' });
  } catch (error) {
    console.error('编辑用户失败:', error);
    return c.json({ code: 500, message: '编辑用户失败' }, 500);
  }
});

/**
 * 删除用户（软删除：将状态设为 deleted，用户名加后缀释放唯一约束）
 * DELETE /api/admin/users/:id
 */
users.delete('/api/admin/users/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    // 不能删除自己
    const admin = (c as any).get('admin');
    if (admin.id === id) {
      return c.json({ code: 400, message: '不能删除当前登录用户' }, 400);
    }

    // 软删除：更新状态为 deleted，用户名加后缀释放唯一约束
    const deletedSuffix = '_deleted_' + Date.now();
    const result = await pool.query(
      "UPDATE admins SET status = 'deleted', username = username || $1, updated_at = NOW() WHERE id = $2 RETURNING id",
      [deletedSuffix, id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({ code: 0, message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户失败:', error);
    return c.json({ code: 500, message: '删除用户失败' }, 500);
  }
});

/**
 * 更新用户状态
 * PUT /api/admin/users/:id/status
 */
users.put('/api/admin/users/:id/status', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { status } = await c.req.json();

    if (!['active', 'disabled', 'locked'].includes(status)) {
      return c.json({ code: 400, message: '无效的状态值' }, 400);
    }

    const result = await pool.query(
      'UPDATE admins SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status',
      [status, id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0], message: '状态更新成功' });
  } catch (error) {
    console.error('更新用户状态失败:', error);
    return c.json({ code: 500, message: '更新用户状态失败' }, 500);
  }
});

/**
 * 重置密码
 * PUT /api/admin/users/:id/reset-password
 */
users.put('/api/admin/users/:id/reset-password', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const newHash = await bcrypt.hash('123456', 10);

    await pool.query('UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, id]);

    return c.json({ code: 0, message: '密码已重置为 123456' });
  } catch (error) {
    console.error('重置密码失败:', error);
    return c.json({ code: 500, message: '重置密码失败' }, 500);
  }
});

export default users;
