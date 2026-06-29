import { Hono } from 'hono';
import { pool } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';

const products = new Hono();

// 所有产品路由都需要认证
products.use('/api/admin/products/*', authMiddleware);
products.use('/api/admin/products', authMiddleware);

/**
 * 获取产品列表（分页、搜索、筛选）
 * GET /api/admin/products
 */
products.get('/api/admin/products', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const keyword = c.req.query('keyword') || '';
    const brand = c.req.query('brand') || '';
    const category = c.req.query('category') || '';

    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (keyword) {
      conditions.push(`(name ILIKE $${paramIndex} OR model ILIKE $${paramIndex})`);
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    if (brand) {
      conditions.push(`brand = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    if (category) {
      conditions.push(`category = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询总数
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 查询数据
    const dataResult = await pool.query(
      `SELECT id, name, brand, category, model, price, rating, images, created_at, updated_at
       FROM products
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return c.json({
      code: 0,
      data: {
        list: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('获取产品列表失败:', error);
    return c.json({ code: 500, message: '获取产品列表失败' }, 500);
  }
});

/**
 * 获取产品详情
 * GET /api/admin/products/:id
 */
products.get('/api/admin/products/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0] });
  } catch (error) {
    console.error('获取产品详情失败:', error);
    return c.json({ code: 500, message: '获取产品详情失败' }, 500);
  }
});

/**
 * 编辑产品
 * PUT /api/admin/products/:id
 */
products.put('/api/admin/products/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const { name, brand, category, model, price, rating, params: productParams } = body;

    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           brand = COALESCE($2, brand),
           category = COALESCE($3, category),
           model = COALESCE($4, model),
           price = COALESCE($5, price),
           rating = COALESCE($6, rating),
           params = COALESCE($7, params)
       WHERE id = $8
       RETURNING id, name, brand, category, model, price, rating, params, updated_at`,
      [name, brand, category, model, price, rating, productParams ? JSON.stringify(productParams) : null, id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0], message: '更新成功' });
  } catch (error) {
    console.error('编辑产品失败:', error);
    return c.json({ code: 500, message: '编辑产品失败' }, 500);
  }
});

/**
 * 删除产品
 * DELETE /api/admin/products/:id
 */
products.delete('/api/admin/products/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    return c.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('删除产品失败:', error);
    return c.json({ code: 500, message: '删除产品失败' }, 500);
  }
});

/**
 * 批量删除产品
 * POST /api/admin/products/batch/delete
 */
products.post('/api/admin/products/batch/delete', async (c) => {
  try {
    const { ids } = await c.req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ code: 400, message: '请选择要删除的产品' }, 400);
    }

    const result = await pool.query(
      'DELETE FROM products WHERE id = ANY($1) RETURNING id',
      [ids]
    );

    return c.json({
      code: 0,
      message: `成功删除 ${result.rowCount} 个产品`,
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    return c.json({ code: 500, message: '批量删除失败' }, 500);
  }
});

/**
 * 获取所有品牌列表（用于筛选下拉）
 * GET /api/admin/brands
 */
products.get('/api/admin/brands', async (c) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL ORDER BY brand'
    );

    return c.json({
      code: 0,
      data: result.rows.map((r) => r.brand),
    });
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return c.json({ code: 500, message: '获取品牌列表失败' }, 500);
  }
});

/**
 * 获取所有类别列表（用于筛选下拉）
 * GET /api/admin/categories
 */
products.get('/api/admin/categories', async (c) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
    );

    return c.json({
      code: 0,
      data: result.rows.map((r) => r.category),
    });
  } catch (error) {
    console.error('获取类别列表失败:', error);
    return c.json({ code: 500, message: '获取类别列表失败' }, 500);
  }
});

export default products;
