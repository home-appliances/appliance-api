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
    const categoryId = c.req.query('category_id') || '';

    const offset = (page - 1) * limit;

    // 构建查询条件
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (keyword) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.model ILIKE $${paramIndex} OR p.brand ILIKE $${paramIndex})`);
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    if (brand) {
      conditions.push(`p.brand = $${paramIndex}`);
      params.push(brand);
      paramIndex++;
    }

    if (categoryId) {
      conditions.push(`p.category_id = $${paramIndex}`);
      params.push(categoryId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 查询总数
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products p ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // 查询数据（关联 categories 表获取分类信息）
    const dataResult = await pool.query(
      `SELECT p.id, p.name, p.brand, p.category_id, c.name as category_name, c.code as category_code,
              p.model, p.price, p.original_price, p.rating, p.review_count, p.params, p.created_at, p.updated_at
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY p.created_at DESC
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
 * 新增产品
 * POST /api/admin/products
 */
products.post('/api/admin/products', async (c) => {
  try {
    const { name, brand, category_id, model, price, original_price, rating, review_count, params } = await c.req.json();

    if (!name || !brand) {
      return c.json({ code: 400, message: '产品名称和品牌为必填项' }, 400);
    }

    const result = await pool.query(
      `INSERT INTO products (name, brand, category_id, model, price, original_price, rating, review_count, params, source_platform)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'admin')
       RETURNING id, name, brand, category_id, model, price, original_price, rating, review_count, created_at`,
      [name, brand, category_id || null, model || null, price || null, original_price || null, rating || null, review_count || 0, params || '{}']
    );

    return c.json({ code: 0, data: result.rows[0], message: '产品创建成功' });
  } catch (error) {
    console.error('创建产品失败:', error);
    return c.json({ code: 500, message: '创建产品失败' }, 500);
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
      `SELECT p.*, c.name as category_name, c.code as category_code
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    // 获取产品图片
    const images = await pool.query(
      `SELECT * FROM product_images WHERE product_id = $1 ORDER BY image_type, sort_order`,
      [id]
    );

    return c.json({
      code: 0,
      data: {
        ...result.rows[0],
        images: images.rows
      }
    });
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
    const { name, brand, category_id, model, price, original_price, rating, review_count, params: productParams } = await c.req.json();

    const result = await pool.query(
      `UPDATE products
       SET name = COALESCE($1, name),
           brand = COALESCE($2, brand),
           category_id = $3,
           model = COALESCE($4, model),
           price = $5,
           original_price = $6,
           rating = $7,
           review_count = COALESCE($8, review_count),
           params = COALESCE($9, params)
       WHERE id = $10
       RETURNING id, name, brand, category_id, model, price, original_price, rating, review_count, params, updated_at`,
      [name, brand, category_id, model, price, original_price, rating, review_count, productParams ? JSON.stringify(productParams) : null, id]
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

export default products;
