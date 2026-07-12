import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { generateToken, authMiddleware, AdminPayload } from '../../middleware/auth.js';
import * as queries from '../../db/queries.js';

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
    const admin = await queries.getAdminByUsername(username);

    if (!admin) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    if (admin.status !== 'active') {
      return c.json({ code: 403, message: '账号已被禁用' }, 403);
    }

    // 验证密码
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return c.json({ code: 401, message: '用户名或密码错误' }, 401);
    }

    // 更新最后登录时间
    await queries.updateAdminLastLogin(admin.id);

    // 记录操作日志
    await queries.createOperationLog({
      adminId: admin.id,
      operator: admin.username,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      type: 'login',
      target: 'admin',
      result: 'success',
    });

    // 生成 Token
    const token = generateToken({ id: admin.id, username: admin.username, role: admin.role });

    return c.json({
      code: 0,
      data: {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role,
        },
      },
      message: '登录成功',
    });
  } catch (error) {
    console.error('登录失败:', error);
    return c.json({ code: 500, message: '登录失败' }, 500);
  }
});

/**
 * 获取当前登录用户信息
 * GET /api/admin/me
 */
auth.get('/api/admin/me', authMiddleware, async (c) => {
  try {
    const adminPayload = (c as any).get('admin') as AdminPayload;
    const admin = await queries.getAdminById(adminPayload.id);

    if (!admin) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    return c.json({
      code: 0,
      data: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        avatar: admin.avatar,
        lastLogin: admin.lastLogin,
      },
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return c.json({ code: 500, message: '获取用户信息失败' }, 500);
  }
});

/**
 * 修改密码
 * PUT /api/admin/change-password
 */
auth.put('/api/admin/change-password', authMiddleware, async (c) => {
  try {
    const adminPayload = (c as any).get('admin') as AdminPayload;
    const { old_password, new_password } = await c.req.json();

    if (!old_password || !new_password) {
      return c.json({ code: 400, message: '请输入旧密码和新密码' }, 400);
    }

    if (new_password.length < 6) {
      return c.json({ code: 400, message: '新密码长度不能少于6位' }, 400);
    }

    const admin = await queries.getAdminById(adminPayload.id);
    if (!admin) {
      return c.json({ code: 404, message: '用户不存在' }, 404);
    }

    // 验证旧密码
    const valid = await bcrypt.compare(old_password, admin.passwordHash);
    if (!valid) {
      return c.json({ code: 401, message: '旧密码错误' }, 401);
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(new_password, 10);
    await queries.updateAdmin(admin.id, { passwordHash });

    // 记录操作日志
    await queries.createOperationLog({
      adminId: admin.id,
      operator: admin.username,
      ip: c.req.header('x-forwarded-for') || 'unknown',
      type: 'change_password',
      target: 'admin',
      result: 'success',
    });

    return c.json({ code: 0, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    return c.json({ code: 500, message: '修改密码失败' }, 500);
  }
});

export default auth;
