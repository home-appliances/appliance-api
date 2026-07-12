import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import * as queries from '../../db/queries.js';

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
    const productId = c.req.query('product_id') ? parseInt(c.req.query('product_id')!) : undefined;

    if (!productId) {
      return c.json({ code: 400, message: '产品ID为必填项' }, 400);
    }

    const images = await queries.getProductImages(productId);

    return c.json({ code: 0, data: images });
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
    const id = parseInt(c.req.param('id'));
    const image = await queries.getProductImageById(id);

    if (!image) {
      return c.json({ code: 404, message: '图片不存在' }, 404);
    }

    return c.json({ code: 0, data: image });
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

    const result = await queries.createProductImage({
      productId: product_id,
      imageUrl: image_url || null,
      imageType: image_type || 'main',
      sortOrder: sort_order || 0,
    });

    return c.json({ code: 0, data: result, message: '图片添加成功' });
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
    const id = parseInt(c.req.param('id'));
    const { image_url, image_type, sort_order } = await c.req.json();

    const result = await queries.updateProductImage(id, {
      imageUrl: image_url,
      imageType: image_type,
      sortOrder: sort_order,
    });

    if (!result) {
      return c.json({ code: 404, message: '图片不存在' }, 404);
    }

    return c.json({ code: 0, data: result, message: '更新成功' });
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
    const id = parseInt(c.req.param('id'));
    const result = await queries.deleteProductImage(id);

    if (!result) {
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

    await queries.updateProductImageSort(items);

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

    await queries.batchDeleteProductImages(ids);

    return c.json({
      code: 0,
      message: `成功删除 ${ids.length} 张图片`,
    });
  } catch (error) {
    console.error('批量删除失败:', error);
    return c.json({ code: 500, message: '批量删除失败' }, 500);
  }
});

export default productImages;
