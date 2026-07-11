import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jd-appliance-admin-secret-key-2024';

export interface AdminPayload {
  id: number;
  username: string;
  role?: string;
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: AdminPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * 验证 Token
 */
export function verifyToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload;
  } catch {
    return null;
  }
}

/**
 * 认证中间件
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ code: 401, message: '未登录或 Token 无效' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    return c.json({ code: 401, message: 'Token 已过期' }, 401);
  }

  // 将用户信息存储到 context
  c.set('admin', payload);

  await next();
}

/**
 * 超级管理员权限中间件
 */
export async function superAdminMiddleware(c: Context, next: Next) {
  const admin = c.get('admin') as AdminPayload | undefined;

  if (!admin || admin.role !== 'super_admin') {
    return c.json({ code: 403, message: '权限不足，需要超级管理员权限' }, 403);
  }

  await next();
}
