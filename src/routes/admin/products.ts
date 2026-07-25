import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import * as queries from '../../db/queries.js';

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
    const categoryId = c.req.query('category_id') ? parseInt(c.req.query('category_id')!) : undefined;

    const result = await queries.getProducts({
      page,
      limit,
      keyword: keyword || undefined,
      brand: brand || undefined,
      categoryId,
    });

    return c.json({
      code: 0,
      data: {
        list: result.products,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
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
    if (!category_id) {
      return c.json({ code: 400, message: '请选择分类' }, 400);
    }

    const result = await queries.createProduct({
      name,
      brand: String(brand).trim(),
      categoryId: category_id || null,
      model: model ? String(model).trim() : null,
      price: price || null,
      originalPrice: original_price || null,
      rating: rating || null,
      reviewCount: review_count || 0,
      params: params || {},
      sourcePlatform: 'admin',
    });

    return c.json({ code: 0, data: result, message: '产品创建成功' });
  } catch (error: any) {
    console.error('创建产品失败:', error);
    if (error?.name === 'ProductDuplicateError') {
      return c.json({ code: 409, message: error.message, existingId: error.existingId }, 409);
    }
    return c.json({ code: 500, message: error?.message || '创建产品失败' }, 500);
  }
});

/**
 * 获取产品详情
 * GET /api/admin/products/:id
 */
products.get('/api/admin/products/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const product = await queries.getProductById(id);

    if (!product) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    // 获取产品图片
    const images = await queries.getProductImages(id);

    return c.json({
      code: 0,
      data: {
        ...product,
        images,
      },
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
    const id = parseInt(c.req.param('id'));
    const { name, brand, category_id, model, price, original_price, rating, review_count, params: productParams } = await c.req.json();

    const result = await queries.updateProduct(id, {
      name,
      brand,
      categoryId: category_id,
      model,
      price,
      originalPrice: original_price,
      rating,
      reviewCount: review_count,
      params: productParams,
    });

    if (!result) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    return c.json({ code: 0, data: result, message: '更新成功' });
  } catch (error: any) {
    console.error('编辑产品失败:', error);
    if (error?.name === 'ProductDuplicateError') {
      return c.json({ code: 409, message: error.message, existingId: error.existingId }, 409);
    }
    return c.json({ code: 500, message: error?.message || '编辑产品失败' }, 500);
  }
});

/**
 * 删除产品（软删除）
 * DELETE /api/admin/products/:id
 */
products.delete('/api/admin/products/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const result = await queries.deleteProduct(id);

    if (!result) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    return c.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('删除产品失败:', error);
    return c.json({ code: 500, message: '删除产品失败' }, 500);
  }
});

/**
 * 删除产品主图（删除 product_images 中该产品的 main 图）
 * DELETE /api/admin/products/:id/main-image
 */
products.delete('/api/admin/products/:id/main-image', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));

    const product = await queries.getProductById(id);
    if (!product) {
      return c.json({ code: 404, message: '产品不存在' }, 404);
    }

    const { pool } = await import('../../db/index.js');

    // 查该产品的主图记录（若为 OSS URL 则删对象）
    const imgResult = await pool.query(
      `SELECT id, image_url FROM product_images
       WHERE product_id = $1 AND image_type = 'main'
       ORDER BY sort_order ASC, id ASC LIMIT 1`,
      [id]
    );

    if (imgResult.rows.length > 0) {
      const { id: imageId, image_url: imageUrl } = imgResult.rows[0];
      await pool.query('DELETE FROM product_images WHERE id = $1', [imageId]);

      if (imageUrl && String(imageUrl).includes('cheapgo')) {
        try {
          const { deleteImage } = await import('../../utils/oss.js');
          await deleteImage(imageUrl);
        } catch (e) {
          console.warn('删除 OSS 失败（不影响主流程）:', e);
        }
      }
    }

    await pool.query('UPDATE products SET updated_at = NOW() WHERE id = $1', [id]);

    return c.json({ code: 0, message: '主图已删除' });
  } catch (error) {
    console.error('删除产品主图失败:', error);
    return c.json({ code: 500, message: '删除主图失败' }, 500);
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

    const deletedCount = await queries.batchDeleteProducts(ids);

    return c.json({
      code: 0,
      message: `成功删除 ${deletedCount} 个产品`,
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
    const brands = await queries.getBrands();

    return c.json({
      code: 0,
      data: brands,
    });
  } catch (error) {
    console.error('获取品牌列表失败:', error);
    return c.json({ code: 500, message: '获取品牌列表失败' }, 500);
  }
});

export default products;
