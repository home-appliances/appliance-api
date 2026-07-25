/**
 * 管理后台 SSR 路由
 * 用服务端渲染替代静态文件
 */

import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { pool } from '../db/index.js'
import bcrypt from 'bcryptjs'
import { generateToken, authMiddleware, superAdminMiddleware, AdminPayload } from './middleware.js'

type AdminVariables = {
  admin: AdminPayload
}

const admin = new Hono<{ Variables: AdminVariables }>()
import { loginPage } from './pages/login.js'
import { dashboardPage } from './pages/dashboard.js'
import { usersPage, userFormPage } from './pages/users.js'
import { productsPage, productFormPage } from './pages/products.js'
import { categoriesPage, categoryFormPage } from './pages/categories.js'
import { categoryParamsPage, categoryParamFormPage } from './pages/category-params.js'
import { productImagesPage } from './pages/product-images.js'
import { logsPage } from './pages/logs.js'
import { validateAdminParams, type AdminParamDef } from '../utils/validate-param-input.js'

/** 按分类参数规范校验后台提交的 p_* 值 */
async function validateProductParamsInput(
  categoryId: number,
  params: Record<string, string>
) {
  const { getCategoryParams } = await import('../db/queries.js')
  const rows = await getCategoryParams(categoryId)
  const defs: AdminParamDef[] = rows.map((r) => {
    let enumValues: string[] | null = null
    const raw = r.enumValues as unknown
    if (Array.isArray(raw)) {
      enumValues = raw.map(String)
    } else if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) enumValues = parsed.map(String)
      } catch {
        enumValues = null
      }
    }
    return {
      paramKey: r.paramKey,
      paramType: r.paramType || 'text',
      enumValues,
      displayName: r.displayName || r.paramKey,
    }
  })
  return validateAdminParams(defs, params)
}

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
      path: '/',
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
  deleteCookie(c, 'admin_token', { path: '/' })
  return c.redirect('/admin/login')
})

// ==================== 仪表盘 ====================

admin.get('/', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'

  try {
    const { getDashboardStats } = await import('../db/queries.js')
    const { pool } = await import('../db/index.js')

    // 获取基础统计
    const stats = await getDashboardStats()

    // 获取分类统计（每个分类的产品数）
    const categoryStatsResult = await pool.query(`
      SELECT c.id, c.code, c.name, c.display_name, c.icon,
             COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.deleted_at IS NULL
      WHERE c.is_active = true
      GROUP BY c.id, c.code, c.name, c.display_name, c.icon, c.sort_order
      ORDER BY c.sort_order
    `)
    const categoryStats = categoryStatsResult.rows.map(row => ({
      id: row.id,
      code: row.code,
      name: row.display_name || row.name,
      icon: row.icon,
      product_count: parseInt(row.product_count),
    }))

    // 获取最近添加的产品
    const recentProductsResult = await pool.query(`
      SELECT p.id, p.name, p.brand, c.name as category_name, p.created_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 5
    `)

    // 获取热门搜索（与 /api/hot 一致：次数优先，同分看最近搜索）
    const hotSearchesResult = await pool.query(`
      SELECT keyword, search_count
      FROM search_logs
      WHERE char_length(trim(keyword)) >= 2
      ORDER BY search_count DESC, last_searched_at DESC
      LIMIT 10
    `)

    return c.html(dashboardPage({
      totalProducts: stats.totalProducts,
      totalBrands: stats.totalBrands,
      totalCategories: stats.totalCategories,
      totalSearches: stats.totalSearches,
      categoryStats,
      recentProducts: recentProductsResult.rows,
      hotSearches: hotSearchesResult.rows,
    }, role))
  } catch (error: any) {
    console.error('仪表盘加载失败:', error)
    return c.html(dashboardPage({
      totalProducts: 0,
      totalBrands: 0,
      totalCategories: 0,
      totalSearches: 0,
      categoryStats: [],
      recentProducts: [],
      hotSearches: [],
    }, role))
  }
})

// ==================== 用户管理（仅超级管理员）====================

// 用户列表
admin.get('/users', authMiddleware, superAdminMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'

  const result = await pool.query(
    "SELECT id, username, name, email, phone, role, status, created_at, last_login FROM admins WHERE status != 'deleted' ORDER BY id"
  )
  return c.html(usersPage(result.rows, role))
})

// 新增用户页面
admin.get('/users/create', authMiddleware, superAdminMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  return c.html(userFormPage(undefined, undefined, role))
})

// 新增用户处理
admin.post('/users/create', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    const adminUser = c.get('admin') as { role?: string }
    const currentRole = adminUser?.role || 'admin'

    const body = await c.req.parseBody()
    const { username, password, name, email, phone, role } = body as Record<string, string>

    if (!username || !password) {
      return c.html(userFormPage(undefined, '用户名和密码不能为空', currentRole))
    }

    const exists = await pool.query('SELECT id FROM admins WHERE username = $1', [username])
    if (exists.rows.length > 0) {
      return c.html(userFormPage(undefined, '用户名已存在', currentRole))
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await pool.query(
      'INSERT INTO admins (username, password_hash, name, email, phone, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [username, passwordHash, name || null, email || null, phone || null, role || 'admin', 'active']
    )

    return c.redirect('/admin/users')
  } catch (error: any) {
    const adminUser = c.get('admin') as { role?: string }
    const currentRole = adminUser?.role || 'admin'
    return c.html(userFormPage(undefined, '创建失败: ' + error.message, currentRole))
  }
})

// 编辑用户页面
admin.get('/users/:id/edit', authMiddleware, superAdminMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const currentRole = adminUser?.role || 'admin'

  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM admins WHERE id = $1', [id])
  if (result.rows.length === 0) return c.redirect('/admin/users')
  return c.html(userFormPage(result.rows[0], undefined, currentRole))
})

// 编辑用户处理
admin.post('/users/:id/edit', authMiddleware, superAdminMiddleware, async (c) => {
  try {
    const adminUser = c.get('admin') as { role?: string }
    const currentRole = adminUser?.role || 'admin'

    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const { name, email, phone, role } = body as Record<string, string>

    await pool.query(
      'UPDATE admins SET name=$1, email=$2, phone=$3, role=$4, updated_at=NOW() WHERE id=$5',
      [name || null, email || null, phone || null, role || 'admin', id]
    )

    return c.redirect('/admin/users')
  } catch (error: any) {
    const adminUser = c.get('admin') as { role?: string }
    const currentRole = adminUser?.role || 'admin'
    return c.html(userFormPage(undefined, '更新失败: ' + error.message, currentRole))
  }
})

// 切换用户状态
admin.post('/users/:id/toggle-status', authMiddleware, superAdminMiddleware, async (c) => {
  const id = c.req.param('id')
  const result = await pool.query('SELECT status FROM admins WHERE id = $1', [id])
  if (result.rows.length > 0) {
    const newStatus = result.rows[0].status === 'active' ? 'disabled' : 'active'
    await pool.query('UPDATE admins SET status=$1, updated_at=NOW() WHERE id=$2', [newStatus, id])
  }
  return c.redirect('/admin/users')
})

// 删除用户
admin.post('/users/:id/delete', authMiddleware, superAdminMiddleware, async (c) => {
  const id = c.req.param('id')
  // 先检查用户是否已经是删除状态，避免重复追加 _deleted_
  const result = await pool.query('SELECT status FROM admins WHERE id = $1', [id])
  if (result.rows.length > 0 && result.rows[0].status !== 'deleted') {
    await pool.query(
      "UPDATE admins SET status='deleted', username=username || '_deleted_' || id WHERE id=$1",
      [id]
    )
  }
  return c.redirect('/admin/users')
})

// ==================== 产品管理 ====================

admin.get('/products', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'

  const page = parseInt(c.req.query('page') || '1')
  const pageSize = 20
  const keyword = c.req.query('keyword') || ''
  const brandFilter = c.req.query('brand') || ''
  const categoryFilter = c.req.query('category') || ''
  const sort = (c.req.query('sort') || 'created_at') as 'created_at' | 'updated_at'
  const order = (c.req.query('order') || 'desc') as 'asc' | 'desc'

  // 品牌别名映射
  const brandNameMap: Record<string, string> = {
    '小米': 'xiaomi', '海尔': 'haier', '美的': 'midea', '格力': 'gree',
    '奥克斯': 'aux', '海信': 'hisense', 'tcl': 'tcl', '松下': 'panasonic',
    '大金': 'daikin', '三菱': 'mitsubishi', '科龙': 'kelon', '志高': 'chigo',
    '长虹': 'changhong', '小天鹅': 'little_swan',
  }

  // 分类词 → category code 映射
  const categoryKeywordMap: Record<string, string> = {
    '冰箱': 'icebox', '冰柜': 'icebox',
    '空调': 'air_condition', '柜机': 'air_condition', '挂机': 'air_condition',
    '洗衣机': 'washer', '滚筒': 'washer', '波轮': 'washer',
    '热水器': 'gas_water', '燃气热水器': 'gas_water',
    '电视': 'lcd_tv', '液晶电视': 'lcd_tv',
    '取暖器': 'heater', '电饭煲': 'rice_cooker', '油烟机': 'range_hood',
  }

  // 解析关键词，提取品牌和分类
  let searchKeyword = keyword
  let brandSearch: string | string[] = brandFilter
  let categoryCode = categoryFilter

  if (keyword) {
    const lower = keyword.toLowerCase().trim()
    // 检查是否包含品牌名
    for (const [cn, en] of Object.entries(brandNameMap)) {
      if (lower.includes(cn) || lower.includes(en)) {
        brandSearch = [cn, en]
        searchKeyword = lower.replace(cn, '').replace(en, '').trim()
        break
      }
    }
    // 检查是否包含分类词
    for (const [word, code] of Object.entries(categoryKeywordMap)) {
      if (lower.includes(word)) {
        categoryCode = code
        searchKeyword = searchKeyword.replace(word, '').trim()
        break
      }
    }
  }

  // 使用 Drizzle 查询
  const { getProducts, getBrands } = await import('../db/queries.js')

  const result = await getProducts({
    page,
    limit: pageSize,
    keyword: searchKeyword || undefined,
    brand: brandSearch || undefined,
    categoryCode: categoryCode || undefined,
    sort,
    order,
  })

  const brands = await getBrands()

  return c.html(productsPage(
    result.products.map(p => ({
      id: p.id,
      title: p.name,
      brand: p.brand || null,
      model: p.model || null,
      category: p.categoryName || null,
      price: p.price,
      original_price: p.originalPrice,
      rating: p.rating,
      review_count: p.reviewCount,
      created_at: p.createdAt ? p.createdAt.toISOString() : null,
      updated_at: p.updatedAt ? p.updatedAt.toISOString() : null,
      image_url: p.mainImage || null,
    })),
    page,
    result.total,
    pageSize,
    role,
    { keyword, brand: brandFilter, category: categoryFilter, sort, order },
    brands
  ))
})

// 新增产品页面
admin.get('/products/create', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  const { getCategories } = await import('../db/queries.js')
  const categories = await getCategories()
  return c.html(productFormPage(undefined, undefined, role, categories))
})

// 新增产品处理（表单用 fetch 提交：成功 302，失败 JSON）
admin.post('/products/create', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody()
    const { name, brand, model, category_id, price, source_platform } = body as Record<string, string>

    if (!name?.trim()) {
      return c.json({ code: 400, message: '产品名称不能为空' }, 400)
    }
    if (!brand?.trim()) {
      return c.json({ code: 400, message: '品牌不能为空' }, 400)
    }
    if (!category_id) {
      return c.json({ code: 400, message: '请选择分类' }, 400)
    }

    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith('p_') && typeof value === 'string' && value.trim() !== '') {
        params[key.slice(2)] = value.trim()
      }
    }

    const categoryId = parseInt(category_id, 10)
    const paramErrors = await validateProductParamsInput(categoryId, params)
    if (paramErrors.length) {
      return c.json(
        {
          code: 400,
          message: '参数填写不合法：\n' + paramErrors.map((e) => e.message).join('\n'),
          errors: paramErrors,
        },
        400
      )
    }

    const { createProduct, ProductDuplicateError } = await import('../db/queries.js')
    try {
      const product = await createProduct({
        name: name.trim(),
        brand: brand.trim(),
        model: model?.trim() || null,
        categoryId,
        price: price || null,
        params,
        sourcePlatform: source_platform?.trim() || 'admin',
      })

      await saveProductImageFiles(product.id, body)
      return c.redirect('/admin/products')
    } catch (err: any) {
      const isDup = err?.name === 'ProductDuplicateError' || err instanceof ProductDuplicateError
      return c.json(
        {
          code: isDup ? 409 : 500,
          message: isDup ? err.message : '创建失败: ' + (err?.message || String(err)),
          existingId: isDup ? err.existingId : undefined,
        },
        isDup ? 409 : 500
      )
    }
  } catch (error: any) {
    return c.json({ code: 500, message: '创建失败: ' + (error?.message || String(error)) }, 500)
  }
})

// 处理表单主图: 本地 images-data 或 OSS，只写 products.main_image
async function saveProductImageFiles(productId: number, body: Record<string, any>): Promise<void> {
  const { validateImageFile } = await import('../utils/oss.js')
  const {
    useLocalImageStorage,
    saveBufferToLocal,
  } = await import('../utils/image-local.js')
  const { uploadBufferViaStaging } = await import('../utils/image-oss-pipeline.js')
  const { pool } = await import('../db/index.js')

  const toArr = (v: any) => Array.isArray(v) ? v : (v ? [v] : [])
  const dataArr = toArr(body['image_data[]'])
  const nameArr = toArr(body['image_names[]'])
  const mimeArr = toArr(body['image_mimes[]'])

  if (dataArr.length === 0) return

  const base64 = dataArr[0]
  const fileName = nameArr[0] || 'image.png'
  const mimeType = mimeArr[0] || 'image/png'
  const buf = Buffer.from(base64, 'base64')

  const validation = validateImageFile({ size: buf.length, originalName: fileName, mimeType })
  if (!validation.valid) {
    console.warn(`主图校验失败, 跳过: ${fileName} - ${validation.error}`)
    return
  }

  let imageUrl: string
  if (useLocalImageStorage()) {
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '.jpg'
    const named = saveBufferToLocal(buf, {
      filename: `p${productId}-main${ext}`,
      mimeType,
    })
    imageUrl = named.url
    console.log(`主图已存本地: ${named.filePath}`)
  } else {
    imageUrl = await uploadBufferViaStaging(buf, {
      originalName: fileName,
      mimeType,
      folder: 'products',
    })
    console.log(`主图已上传 OSS: ${imageUrl}`)
  }

  await pool.query(
    'UPDATE products SET main_image = $1, image_id = NULL, updated_at = NOW() WHERE id = $2',
    [imageUrl, productId]
  )
  console.log(`已设置 main_image: ${imageUrl}`)
}

// 编辑产品页面
admin.get('/products/:id/edit', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'

  const id = parseInt(c.req.param('id'))
  let returnTo = c.req.query('return_to') || '/admin/products'
  if (!returnTo.startsWith('/admin/products')) {
    returnTo = '/admin/products'
  }

  const { getProductById, getCategories } = await import('../db/queries.js')
  const [product, categories] = await Promise.all([
    getProductById(id),
    getCategories(),
  ])

  if (!product) return c.redirect(returnTo)

  // 使用 mainImage 作为主图
  const productWithImages = {
    ...product,
    images: product.mainImage ? [{
      id: product.imageId || 0,
      imageUrl: product.mainImage,
      imageType: 'main',
      sortOrder: 0,
    }] : [],
  }

  return c.html(productFormPage(productWithImages, undefined, role, categories, returnTo))
})

// 编辑产品处理（表单用 fetch 提交：成功 302，失败 JSON）
admin.post('/products/:id/edit', authMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ code: 400, message: '无效的产品 ID，请从产品列表重新进入编辑' }, 400)
    }
    const body = await c.req.parseBody()
    const { name, brand, model, category_id, price, source_platform } = body as Record<string, string>

    let returnTo = (body as Record<string, string>).return_to || '/admin/products'
    if (typeof returnTo !== 'string' || !returnTo.startsWith('/admin/products')) {
      returnTo = '/admin/products'
    }

    if (!name?.trim()) {
      return c.json({ code: 400, message: '产品名称不能为空' }, 400)
    }
    if (!brand?.trim()) {
      return c.json({ code: 400, message: '品牌不能为空' }, 400)
    }
    if (!category_id) {
      return c.json({ code: 400, message: '请选择分类' }, 400)
    }

    const params: Record<string, string> = {}
    for (const [key, value] of Object.entries(body)) {
      if (key.startsWith('p_') && typeof value === 'string' && value.trim() !== '') {
        params[key.slice(2)] = value.trim()
      }
    }

    const categoryId = parseInt(category_id, 10)
    const paramErrors = await validateProductParamsInput(categoryId, params)
    if (paramErrors.length) {
      return c.json(
        {
          code: 400,
          message: '参数填写不合法：\n' + paramErrors.map((e) => e.message).join('\n'),
          errors: paramErrors,
        },
        400
      )
    }

    const { updateProduct, ProductDuplicateError } = await import('../db/queries.js')
    try {
      await updateProduct(id, {
        name: name.trim(),
        brand: brand.trim(),
        model: model?.trim() || null,
        categoryId,
        price: price || null,
        params,
        sourcePlatform: source_platform?.trim() || null,
      })

      await saveProductImageFiles(id, body)
      return c.redirect(returnTo)
    } catch (err: any) {
      const isDup = err?.name === 'ProductDuplicateError' || err instanceof ProductDuplicateError
      return c.json(
        {
          code: isDup ? 409 : 500,
          message: isDup ? err.message : '更新失败: ' + (err?.message || String(err)),
          existingId: isDup ? err.existingId : undefined,
        },
        isDup ? 409 : 500
      )
    }
  } catch (error: any) {
    return c.json({ code: 500, message: '更新失败: ' + (error?.message || String(error)) }, 500)
  }
})

// 删除产品
admin.post('/products/:id/delete', authMiddleware, async (c) => {
  const id = parseInt(c.req.param('id'))
  const adminUser = (c as any).get('admin') as { username: string }

  const { deleteProduct } = await import('../db/queries.js')
  await deleteProduct(id, adminUser.username)

  return c.redirect('/admin/products')
})

// ==================== 分类管理 ====================

// 分类列表
admin.get('/categories', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'

  const result = await pool.query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM products WHERE category_id = c.id AND deleted_at IS NULL) as product_count,
      (SELECT COUNT(*) FROM category_params WHERE category_id = c.id) as param_count
    FROM categories c
    ORDER BY c.sort_order, c.name
  `)
  return c.html(categoriesPage(result.rows, role))
})

// 新增分类页面
admin.get('/categories/create', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
  return c.html(categoryFormPage(undefined, categories.rows, undefined, role))
})

// 新增分类处理
admin.post('/categories/create', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody()
    const { code, name, display_name, icon, parent_id, sort_order, is_active } = body as Record<string, string>

    if (!code || !name) {
      const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
      return c.html(categoryFormPage(undefined, categories.rows, '编码和名称不能为空'))
    }

    await pool.query(
      'INSERT INTO categories (code, name, display_name, icon, parent_id, sort_order, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [code, name, display_name || name, icon || null, parent_id || null, parseInt(sort_order || '0'), is_active === 'true']
    )
    return c.redirect('/admin/categories')
  } catch (error: any) {
    const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
    return c.html(categoryFormPage(undefined, categories.rows, '创建失败: ' + error.message))
  }
})

// 编辑分类页面
admin.get('/categories/:id/edit', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  const id = c.req.param('id')
  const result = await pool.query('SELECT * FROM categories WHERE id = $1', [id])
  if (result.rows.length === 0) return c.redirect('/admin/categories')
  const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
  return c.html(categoryFormPage(result.rows[0], categories.rows, undefined, role))
})

// 编辑分类处理
admin.post('/categories/:id/edit', authMiddleware, async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const body = await c.req.parseBody()
    const { name, display_name, icon, parent_id, sort_order, is_active } = body as Record<string, string>

    // 校验：不能把自己设为父分类（自引用）
    if (parent_id && parseInt(parent_id) === id) {
      const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
      const current = categories.rows.find(c => c.id === id)
      return c.html(categoryFormPage(current, categories.rows, '不能将分类设为自己的父分类（自引用会导致循环引用）'))
    }

    // 校验：不能把子孙分类设为父分类（会形成环）
    if (parent_id) {
      const pid = parseInt(parent_id)
      const allCats = (await pool.query('SELECT id, parent_id FROM categories')).rows
      let cur: number | null = pid
      const visited = new Set<number>()
      while (cur !== null && !visited.has(cur)) {
        if (cur === id) {
          const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
          const current = categories.rows.find(c => c.id === id)
          return c.html(categoryFormPage(current, categories.rows, '不能将子孙分类设为父分类（会形成循环引用）'))
        }
        visited.add(cur)
        const node = allCats.find(c => c.id === cur)
        cur = node?.parent_id ?? null
      }
    }

    await pool.query(
      'UPDATE categories SET name=$1, display_name=$2, icon=$3, parent_id=$4, sort_order=$5, is_active=$6 WHERE id=$7',
      [name, display_name || name, icon || null, parent_id || null, parseInt(sort_order || '0'), is_active === 'true', id]
    )
    return c.redirect('/admin/categories')
  } catch (error: any) {
    const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
    return c.html(categoryFormPage({ id: c.req.param('id') }, categories.rows, '更新失败: ' + error.message))
  }
})

// 删除分类
admin.post('/categories/:id/delete', authMiddleware, async (c) => {
  const id = c.req.param('id')
  await pool.query('DELETE FROM categories WHERE id = $1', [id])
  return c.redirect('/admin/categories')
})

// ==================== 参数规范管理 ====================

// 参数规范列表
admin.get('/category-params', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  const categoryId = c.req.query('category_id') ? parseInt(c.req.query('category_id')!) : undefined

  let query = `
    SELECT cp.*, c.name as category_name, c.display_name as category_display_name
    FROM category_params cp
    LEFT JOIN categories c ON c.id = cp.category_id
  `
  const params: any[] = []
  if (categoryId) {
    query += ' WHERE cp.category_id = $1'
    params.push(categoryId)
  }
  query += ' ORDER BY cp.category_id, cp.sort_order'

  const [result, categories] = await Promise.all([
    pool.query(query, params),
    pool.query('SELECT * FROM categories ORDER BY sort_order')
  ])
  return c.html(categoryParamsPage(result.rows, categories.rows, role, categoryId))
})

// 新增参数规范页面
admin.get('/category-params/create', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
  return c.html(categoryParamFormPage(undefined, categories.rows, undefined, role))
})

// 新增参数规范处理
admin.post('/category-params/create', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody()
    const { category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order } = body as Record<string, string>

    if (!category_id || !param_key || !display_name) {
      const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
      return c.html(categoryParamFormPage(undefined, categories.rows, '分类、参数名和显示名不能为空'))
    }

    let enumValuesJson = null
    if (enum_values) {
      try { enumValuesJson = JSON.parse(enum_values) } catch { enumValuesJson = null }
    }

    await pool.query(
      'INSERT INTO category_params (category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [category_id, param_key, display_name, icon || null, param_type || 'text', is_core === 'true', is_filter === 'true', is_sortable === 'true', enumValuesJson ? JSON.stringify(enumValuesJson) : null, parseInt(sort_order || '0')]
    )
    return c.redirect('/admin/category-params')
  } catch (error: any) {
    const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
    return c.html(categoryParamFormPage(undefined, categories.rows, '创建失败: ' + error.message))
  }
})

// 编辑参数规范页面
admin.get('/category-params/:id/edit', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  const id = c.req.param('id')
  const [result, categories] = await Promise.all([
    pool.query('SELECT * FROM category_params WHERE id = $1', [id]),
    pool.query('SELECT * FROM categories ORDER BY sort_order')
  ])
  if (result.rows.length === 0) return c.redirect('/admin/category-params')
  return c.html(categoryParamFormPage(result.rows[0], categories.rows, undefined, role))
})

// 编辑参数规范处理
admin.post('/category-params/:id/edit', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.parseBody()
    const { param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order } = body as Record<string, string>

    let enumValuesJson = null
    if (enum_values) {
      try { enumValuesJson = JSON.parse(enum_values) } catch { enumValuesJson = null }
    }

    await pool.query(
      'UPDATE category_params SET param_key=$1, display_name=$2, icon=$3, param_type=$4, is_core=$5, is_filter=$6, is_sortable=$7, enum_values=$8, sort_order=$9 WHERE id=$10',
      [param_key, display_name, icon || null, param_type || 'text', is_core === 'true', is_filter === 'true', is_sortable === 'true', enumValuesJson ? JSON.stringify(enumValuesJson) : null, parseInt(sort_order || '0'), id]
    )
    return c.redirect('/admin/category-params')
  } catch (error: any) {
    const categories = await pool.query('SELECT * FROM categories ORDER BY sort_order')
    return c.html(categoryParamFormPage({ id: c.req.param('id') }, categories.rows, '更新失败: ' + error.message))
  }
})

// 删除参数规范
admin.post('/category-params/:id/delete', authMiddleware, async (c) => {
  const id = c.req.param('id')
  await pool.query('DELETE FROM category_params WHERE id = $1', [id])
  return c.redirect('/admin/category-params')
})

// ==================== 图片管理 ====================
// 管理 products.main_image

// 图片列表：展示有主图的产品
admin.get('/product-images', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'
  const productId = c.req.query('product_id') ? parseInt(c.req.query('product_id')!) : undefined
  const page = Math.max(1, parseInt(c.req.query('page') || '1'))
  const pageSize = 50
  const offset = (page - 1) * pageSize

  // 查询有主图的产品（支持按产品筛选）
  let whereClause = 'WHERE p.deleted_at IS NULL AND p.main_image IS NOT NULL'
  const params: any[] = []
  if (productId) {
    whereClause += ' AND p.id = $1'
    params.push(productId)
  }

  // 并行查询：主图列表 + 总数 + 全部产品（用于筛选下拉）
  // 用别名转为驼峰命名，与页面接口字段对齐
  const listQuery = `
    SELECT p.id, p.name, p.brand, p.model,
           p.main_image AS "mainImage",
           p.image_id AS "imageId",
           p.updated_at AS "updatedAt"
    FROM products p
    ${whereClause}
    ORDER BY p.updated_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `
  const countQuery = `SELECT COUNT(*) FROM products p ${whereClause}`

  const [listResult, countResult, allProducts] = await Promise.all([
    pool.query(listQuery, [...params, pageSize, offset]),
    pool.query(countQuery, params),
    pool.query('SELECT id, name FROM products WHERE deleted_at IS NULL ORDER BY id DESC LIMIT 200'),
  ])

  const total = parseInt(countResult.rows[0]?.count || '0')

  return c.html(productImagesPage(
    listResult.rows,
    allProducts.rows,
    role,
    productId,
    total,
    page,
    pageSize,
  ))
})

// 删除产品主图（清除 main_image；若为 OSS URL 则删对象；不再依赖 images BYTEA）
admin.post('/product-images/:id/delete', authMiddleware, async (c) => {
  const productId = parseInt(c.req.param('id'))

  try {
    const productResult = await pool.query(
      'SELECT main_image, image_id FROM products WHERE id = $1',
      [productId]
    )

    if (productResult.rows.length === 0) {
      return c.redirect('/admin/product-images')
    }

    const { main_image: mainImage, image_id: imageId } = productResult.rows[0]

    await pool.query(
      'UPDATE products SET main_image = NULL, image_id = NULL, updated_at = NOW() WHERE id = $1',
      [productId]
    )

    if (mainImage && String(mainImage).includes('cheapgo')) {
      try {
        const { deleteImage } = await import('../utils/oss.js')
        await deleteImage(mainImage)
      } catch (e) {
        console.warn(`[图片管理] 删除 OSS 失败（不影响主流程）:`, e)
      }
    }

    if (imageId) {
      try {
        await pool.query('DELETE FROM images WHERE id = $1', [imageId])
      } catch {
        /* images 表可能已清空 */
      }
    }

    console.log(`[图片管理] 已删除产品 #${productId} 的主图`)
  } catch (error: any) {
    console.error('[图片管理] 删除主图失败:', error)
  }

  return c.redirect('/admin/product-images')
})

// ==================== 操作日志 ====================

admin.get('/logs', authMiddleware, async (c) => {
  const adminUser = c.get('admin') as { role?: string }
  const role = adminUser?.role || 'admin'

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
    pageSize,
    role
  ))
})

// 删除单条日志（仅超级管理员）
admin.post('/logs/:id/delete', authMiddleware, superAdminMiddleware, async (c) => {
  const id = c.req.param('id')
  await pool.query('DELETE FROM operation_logs WHERE id = $1', [id])
  return c.redirect('/admin/logs')
})

// 清空所有日志（仅超级管理员）
admin.post('/logs/clear', authMiddleware, superAdminMiddleware, async (c) => {
  await pool.query('DELETE FROM operation_logs')
  return c.redirect('/admin/logs')
})

export default admin
