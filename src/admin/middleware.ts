/**
 * 管理后台认证中间件
 * 使用 Cookie 存储 JWT Token
 */

import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'jd-appliance-admin-secret-key-2024'

export interface AdminPayload {
  id: number
  username: string
  role?: string
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminPayload
  } catch {
    return null
  }
}

/**
 * 生成 JWT Token
 */
export function generateToken(payload: AdminPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

/**
 * 认证中间件：检查 Cookie 中的 Token
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const token = getCookie(c, 'admin_token')

  if (!token) {
    return c.redirect('/admin/login')
  }

  const payload = verifyToken(token)
  if (!payload) {
    return c.redirect('/admin/login')
  }

  c.set('admin', payload)
  await next()
}
