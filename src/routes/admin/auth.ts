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
      'SELECT id, username, password_hash FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    const admin = result.rows[0];

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

    // 生成 Token
    const token = generateToken({ id: admin.id, username: admin.username });

    return c.json({
      code: 0,
      data: {
        token,
        username: admin.username,
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
  const admin = (c as any).get('admin') as { id: number; username: string };
  return c.json({
    code: 0,
    data: {
      id: admin.id,
      username: admin.username,
    },
  });
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
      'UPDATE admins SET password_hash = $1 WHERE id = $2',
      [newHash, admin.id]
    );

    return c.json({ code: 0, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    return c.json({ code: 500, message: '修改密码失败' }, 500);
  }
});

export default auth;
