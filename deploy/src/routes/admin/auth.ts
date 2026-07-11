import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { pool } from '../../db/index.js';
import { generateToken, authMiddleware } from '../../middleware/auth.js';

const auth = new Hono();

/**
 * 管理员登录
 * POST /api/admin/login
 */
auth.post('/api/admin/login', async (c) => {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json({ code: 400, message: '用户名和密码不能为空' }, 400);
    }

    // 查询管理员
    const result = await pool.query(
      'SELECT id, username, name, email, phone, role, status, avatar, password_hash FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    const admin = result.rows[0];

    // 检查账号状态
    if (admin.status === 'deleted') {
      return c.json({ code: 403, message: '账号不存在或已被删除' }, 403);
    }
    if (admin.status === 'disabled') {
      return c.json({ code: 403, message: '账号已被禁用，请联系管理员' }, 403);
    }
    if (admin.status === 'locked') {
      return c.json({ code: 403, message: '账号已被锁定，请联系管理员' }, 403);
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    // 更新最后登录时间
    await pool.query(
      'UPDATE admins SET last_login = NOW() WHERE id = $1',
      [admin.id]
    );

    // 记录登录日志
    await pool.query(
      `INSERT INTO operation_logs (admin_id, operator, ip, type, target, result, detail)
       VALUES ($1, $2, $3, 'login', '登录系统', 'success', '')`,
      [admin.id, admin.name || admin.username, c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown']
    );

    // 生成 Token
    const token = generateToken({ id: admin.id, username: admin.username, role: admin.role });

    return c.json({
      code: 0,
      data: {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.name || admin.username,
          email: admin.email,
          phone: admin.phone,
          role: admin.role || 'admin',
          avatar: admin.avatar || (admin.name || admin.username).slice(0, 2),
        },
      },
    });
  } catch (error) {
    console.error('登录失败:', error);
    return c.json({ code: 500, message: '登录失败' }, 500);
  }
});

/**
 * 获取当前用户信息
 * GET /api/admin/profile
 */
auth.get('/api/admin/profile', authMiddleware, async (c) => {
  try {
    const admin = (c as any).get('admin') as { id: number; username: string };
    const result = await pool.query(
      'SELECT id, username, name, email, phone, role, status, avatar, created_at, last_login FROM admins WHERE id = $1',
      [admin.id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0] });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return c.json({ code: 500, message: '获取用户信息失败' }, 500);
  }
});

/**
 * 修改个人信息
 * PUT /api/admin/profile
 */
auth.put('/api/admin/profile', authMiddleware, async (c) => {
  try {
    const admin = (c as any).get('admin') as { id: number; username: string };
    const { name, email, phone } = await c.req.json();

    const result = await pool.query(
      'UPDATE admins SET name = $1, email = $2, phone = $3, updated_at = NOW() WHERE id = $4 RETURNING id, username, name, email, phone, role, avatar',
      [name, email || null, phone || null, admin.id]
    );

    return c.json({ code: 0, data: result.rows[0], message: '个人信息更新成功' });
  } catch (error) {
    console.error('更新个人信息失败:', error);
    return c.json({ code: 500, message: '更新个人信息失败' }, 500);
  }
});

/**
 * 修改密码
 * PUT /api/admin/password
 */
auth.put('/api/admin/password', authMiddleware, async (c) => {
  try {
    const admin = (c as any).get('admin') as { id: number; username: string };
    const { oldPassword, newPassword } = await c.req.json();

    if (!oldPassword || !newPassword) {
      return c.json({ code: 400, message: '请输入旧密码和新密码' }, 400);
    }

    // 验证旧密码
    const result = await pool.query(
      'SELECT password_hash FROM admins WHERE id = $1',
      [admin.id]
    );

    const isValid = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
    if (!isValid) {
      return c.json({ code: 400, message: '旧密码错误' }, 400);
    }

    // 更新密码
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, admin.id]
    );

    return c.json({ code: 0, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    return c.json({ code: 500, message: '修改密码失败' }, 500);
  }
});

export default auth;
