/**
 * 管理后台 SSR 路由
 * 用服务端渲染替代静态文件
 */

import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { pool } from '../db/index.js'
import bcrypt from 'bcryptjs'
import { generateToken, authMiddleware } from './middleware.js'
import { loginPage } from './pages/login.js'
import { dashboardPage } from './pages/dashboard.js'
import { usersPage, userFormPage } from './pages/users.js'
import { productsPage } from './pages/products.js'
import { logsPage } from './pages/logs.js'

const admin = new Hono()

// ==================== 登录 ====================

// 登录页
admin.get('/login', async (c) => {
  return c.html(loginPage())
})

// 登录处理
admin.post('/login', async (c) => {
  try {
    const body = await c.req.parseBody()
    const username = body.username as string
    const password = body.password as string

    if (!username || !password) {
      return c.html(loginPage('请输入用户名和密码'))
    }

    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1 AND status = $2',
      [username, 'active']
    )

    if (result.rows.length === 0) {
      return c.html(loginPage('用户名或密码错误'))
    }

    const adminUser = result.rows[0]
    const valid = await bcrypt.compare(password, adminUser.password_hash)

    if (!valid) {
      return c.html(loginPage('用户名或密码错误'))
    }

    // 更新最后登录时间
    await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [adminUser.id])

    // 记录操作日志
    await pool.query(
      'INSERT INTO operation_logs (admin_id, operator, ip, type, target, result) VALUES ($1, $2, $3, $4, $5, $6)',
      [adminUser.id, adminUser.username, c.req.header('x-forwarded-for') || 'unknown', 'login', 'admin', 'success']
    )

    // 生成 Token 并设置 Cookie
    const token = generateToken({ id: adminUser.id, username: adminUser.username, role: adminUser.role })
    setCookie(c, 'admin_token', token, {
      path: '/admin',
      httpOnly: true,
      maxAge: 86400, // 24 小时
      sameSite: 'Lax',
    })

    return c.redirect('/admin/')
  } catch (error: any) {
    console.error('登录失败:', error)
    return c.html(loginPage('登录失败，请稍后重试'))
  }
})

// 退出登录
admin.get('/logout', async (c) => {
  deleteCookie(c, 'admin_token', { path: '/admin' })
  return c.redirect('/admin/login')
})

// ==================== 仪表盘 ====================

admin.get('/', authMiddleware, async (c) => {
  try {
    const [products, brands, categories, searches] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM products WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(DISTINCT brand) FROM products WHERE deleted_at IS NULL'),
      pool.query('SELECT COUNT(*) FROM categories'),
      pool.query('SELECT COUNT(*) FROM search_logs'),
    ])

    return c.html(dashboardPage({
      totalProducts: parseInt(products.rows[0].count),
      totalBrands: parseInt(brands.rows[0].count),
      totalCategories: parseInt(categories.rows[0].count),
      totalSearches: parseInt(searches.rows[0].count),
    }))
  } catch (error: any) {
    return c.html(dashboardPage({ totalProducts: 0, totalBrands: 0, totalCategories: 0, totalSearches: 0 }))
  }
})

// ==================== 用户管理 ====================

// 用户列表
admin.get('/users', authMiddleware, async (c) => {
  const result = await pool.query(
    'SELECT id, username, name, email, phone, role, status, created_at, last_login FROM admins ORDER BY id'
  )
  return c.html(usersPage(result.rows))
})

// 新增用户页面
admin.get('/users/create', authMiddleware, async (c) => {
  return c.html(userFormPage())
})

// 新增用户处理
admin.post('/users/create', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody()
    const { username, password, name, email, phone, role } = body as Record<string, string>

    if (!username || !password) {
      return c.html(userFormPage(undefined, '用户名和密码不能为空'))
    }

    const exists = await pool.query('SELECT id FROM admins WHERE username = $1', [username])
    if (exists.rows.length > 0) {
      return c.html(userFormPage(undefined, '用户名已存在'))
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await pool.query(
      'INSERT INTO admins (username, password_hash, name, email, phone, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [username, passwordHash, name || null, email || null, phone || null, role || 'admin', 'active']
    )

    return c.redirect('/admin/users')
  } catch (error: any) {
    return c.html(userFormPage(undefined, '创建失败: ' + error.message))
  }
})

// 编辑用户页面
admin.get('/users/:id/edit', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM admins WHERE id = $1', [id])
  if (result.rows.length === 0) return c.redirect('/admin/users')
  return c.html(userFormPage(result.rows[0]))
})

// 编辑用户处理
admin.post('/users/:id/edit', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const { name, email, phone, role } = body as Record<string, string>

    await pool.query(
      'UPDATE admins SET name=$1, email=$2, phone=$3, role=$4, updated_at=NOW() WHERE id=$5',
      [name || null, email || null, phone || null, role || 'admin', id]
    )

    return c.redirect('/admin/users')
  } catch (error: any) {
    return c.html(userFormPage(undefined, '更新失败: ' + error.message))
  }
})

// 切换用户状态
admin.post('/users/:id/toggle-status', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT status FROM admins WHERE id = $1', [id])
  if (result.rows.length > 0) {
    const newStatus = result.rows[0].status === 'active' ? 'disabled' : 'active'
    await pool.query('UPDATE admins SET status=$1, updated_at=NOW() WHERE id=$2', [newStatus, id])
  }
  return c.redirect('/admin/users')
})

// 删除用户
admin.post('/users/:id/delete', authMiddleware, async (c) => {
  const id = c.req.param('id')
  await pool.query("UPDATE admins SET status='deleted', username=username || '_deleted_' || id WHERE id=$1", [id])
  return c.redirect('/admin/users')
})

// ==================== 产品管理 ====================

admin.get('/products', authMiddleware, async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const pageSize = 20
  const offset = (page - 1) * pageSize

  const [products, count] = await Promise.all([
    pool.query(
      `SELECT id, name as title, brand, model, category, created_at
       FROM products
       ORDER BY id DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
    pool.query('SELECT COUNT(*) FROM products'),
  ])

  return c.html(productsPage(
    products.rows,
    page,
    parseInt(count.rows[0].count),
    pageSize
  ))
})

// 删除产品
admin.post('/products/:id/delete', authMiddleware, async (c) => {
  const id = c.req.param('id')
  const adminUser = (c as any).get('admin') as { username: string }
  await pool.query(
    'UPDATE products SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2',
    [adminUser.username, id]
  )
  return c.redirect('/admin/products')
})

// ==================== 操作日志 ====================

admin.get('/logs', authMiddleware, async (c) => {
  const page = parseInt(c.req.query('page') || '1')
  const pageSize = 50
  const offset = (page - 1) * pageSize

  const [logs, count] = await Promise.all([
    pool.query(
      'SELECT * FROM operation_logs ORDER BY id DESC LIMIT $1 OFFSET $2',
      [pageSize, offset]
    ),
    pool.query('SELECT COUNT(*) FROM operation_logs'),
  ])

  return c.html(logsPage(
    logs.rows,
    page,
    parseInt(count.rows[0].count),
    pageSize
  ))
})

export default admin
