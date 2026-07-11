import { Hono } from 'hono';
import { pool } from '../../db/index.js';
import { authMiddleware } from '../../middleware/auth.js';

const productImages = new Hono();

// 所有路由都需要认证
productImages.use('/api/admin/product-images/*', authMiddleware);
productImages.use('/api/admin/product-images', authMiddleware);

/**
 * 获取产品图片列表
 * GET /api/admin/product-images?product_id=xxx
 */
productImages.get('/api/admin/product-images', async (c) => {
  try {
    const productId = c.req.query('product_id');

    let query = 'SELECT * FROM product_images';
    const params: any[] = [];

    if (productId) {
      query += ' WHERE product_id = $1';
      params.push(productId);
    }

    query += ' ORDER BY product_id, image_type, sort_order';

    const result = await pool.query(query, params);

    return c.json({ code: 0, data: result.rows });
  } catch (error) {
    console.error('获取图片列表失败:', error);
    return c.json({ code: 500, message: '获取图片列表失败' }, 500);
  }
});

/**
 * 获取单张图片详情
 * GET /api/admin/product-images/:id
 */
productImages.get('/api/admin/product-images/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query('SELECT * FROM product_images WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '图片不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0] });
  } catch (error) {
    console.error('获取图片详情失败:', error);
    return c.json({ code: 500, message: '获取图片详情失败' }, 500);
  }
});

/**
 * 新增图片
 * POST /api/admin/product-images
 */
productImages.post('/api/admin/product-images', async (c) => {
  try {
    const { product_id, image_url, image_type, sort_order } = await c.req.json();

    if (!product_id) {
      return c.json({ code: 400, message: '产品ID为必填项' }, 400);
    }

    const result = await pool.query(
      `INSERT INTO product_images (product_id, image_url, image_type, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [product_id, image_url || null, image_type || 'main', sort_order || 0]
    );

    return c.json({ code: 0, data: result.rows[0], message: '图片添加成功' });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ code: 400, message: '该排序位置已被占用' }, 400);
    }
    console.error('添加图片失败:', error);
    return c.json({ code: 500, message: '添加图片失败' }, 500);
  }
});

/**
 * 编辑图片
 * PUT /api/admin/product-images/:id
 */
productImages.put('/api/admin/product-images/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { image_url, image_type, sort_order } = await c.req.json();

    const result = await pool.query(
      `UPDATE product_images
       SET image_url = COALESCE($1, image_url),
           image_type = COALESCE($2, image_type),
           sort_order = COALESCE($3, sort_order)
       WHERE id = $4
       RETURNING *`,
      [image_url, image_type, sort_order, id]
    );

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '图片不存在' }, 404);
    }

    return c.json({ code: 0, data: result.rows[0], message: '更新成功' });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ code: 400, message: '该排序位置已被占用' }, 400);
    }
    console.error('编辑图片失败:', error);
    return c.json({ code: 500, message: '编辑图片失败' }, 500);
  }
});

/**
 * 删除图片
 * DELETE /api/admin/product-images/:id
 */
productImages.delete('/api/admin/product-images/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await pool.query('DELETE FROM product_images WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return c.json({ code: 404, message: '图片不存在' }, 404);
    }

    return c.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('删除图片失败:', error);
    return c.json({ code: 500, message: '删除图片失败' }, 500);
  }
});

/**
 * 批量更新排序
 * PUT /api/admin/product-images/batch/sort
 */
productImages.put('/api/admin/product-images/batch/sort', async (c) => {
  try {
    const { items } = await c.req.json();

    if (!items || !Array.isArray(items)) {
      return c.json({ code: 400, message: '参数错误' }, 400);
    }

    for (const item of items) {
      await pool.query('UPDATE product_images SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
    }

    return c.json({ code: 0, message: '排序更新成功' });
  } catch (error) {
    console.error('批量更新排序失败:', error);
    return c.json({ code: 500, message: '批量更新排序失败' }, 500);
  }
});

/**
 * 批量删除图片
 * POST /api/admin/product-images/batch/delete
 */
productImages.post('/api/admin/product-images/batch/delete', async (c) => {
  try {
    const { ids } = await c.req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ code: 400, message: '请选择要删除的图片' }, 400);
    }

    const result = await pool.query(
      'DELETE FROM product_images WHERE id = ANY($1) RETURNING id',
      [ids]
    );

    return c.json({
      code: 0,
      message: `成功删除 ${result.rowCount} 张图片`,
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    return c.json({ code: 500, message: '批量删除失败' }, 500);
  }
});

export default productImages;
