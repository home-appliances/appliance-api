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

/**
 * 超级管理员权限中间件
 */
export const superAdminMiddleware = async (c: Context, next: Next) => {
  const admin = c.get('admin') as AdminPayload

  if (!admin || admin.role !== 'super_admin') {
    return c.html(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>权限不足</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-50 min-h-screen flex items-center justify-center">
        <div class="text-center">
          <div class="text-6xl mb-4">🚫</div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">权限不足</h1>
          <p class="text-gray-500 mb-6">您需要超级管理员权限才能访问此页面</p>
          <a href="/admin/" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">返回首页</a>
        </div>
      </body>
      </html>
    `, 403)
  }

  await next()
}
