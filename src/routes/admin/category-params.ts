import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import * as queries from '../../db/queries.js';

const categoryParams = new Hono();

// 所有路由都需要认证
categoryParams.use('/api/admin/category-params/*', authMiddleware);
categoryParams.use('/api/admin/category-params', authMiddleware);

/**
 * 获取某分类的参数规范列表
 * GET /api/admin/category-params?category_id=xxx
 */
categoryParams.get('/api/admin/category-params', async (c) => {
  try {
    const categoryId = c.req.query('category_id') ? parseInt(c.req.query('category_id')!) : undefined;
    const params = await queries.getCategoryParams(categoryId);

    return c.json({ code: 0, data: params });
  } catch (error) {
    console.error('获取参数规范失败:', error);
    return c.json({ code: 500, message: '获取参数规范失败' }, 500);
  }
});

/**
 * 获取单个参数规范详情
 * GET /api/admin/category-params/:id
 */
categoryParams.get('/api/admin/category-params/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const param = await queries.getCategoryParamById(id);

    if (!param) {
      return c.json({ code: 404, message: '参数规范不存在' }, 404);
    }

    return c.json({ code: 0, data: param });
  } catch (error) {
    console.error('获取参数规范详情失败:', error);
    return c.json({ code: 500, message: '获取参数规范详情失败' }, 500);
  }
});

/**
 * 新增参数规范
 * POST /api/admin/category-params
 */
categoryParams.post('/api/admin/category-params', async (c) => {
  try {
    const {
      category_id, param_key, display_name, icon,
      param_type, is_core, is_filter, is_sortable,
      enum_values, sort_order,
    } = await c.req.json();

    if (!category_id || !param_key || !display_name) {
      return c.json({ code: 400, message: '分类ID、参数名和显示名为必填项' }, 400);
    }

    const result = await queries.createCategoryParam({
      categoryId: category_id,
      paramKey: param_key,
      displayName: display_name,
      icon: icon || null,
      paramType: param_type || 'text',
      isCore: is_core || false,
      isFilter: is_filter || false,
      isSortable: is_sortable || false,
      enumValues: enum_values || null,
      sortOrder: sort_order || 0,
    });

    return c.json({ code: 0, data: result, message: '参数规范创建成功' });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ code: 400, message: '该分类下已存在同名参数' }, 400);
    }
    console.error('创建参数规范失败:', error);
    return c.json({ code: 500, message: '创建参数规范失败' }, 500);
  }
});

/**
 * 编辑参数规范
 * PUT /api/admin/category-params/:id
 */
categoryParams.put('/api/admin/category-params/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const {
      param_key, display_name, icon,
      param_type, is_core, is_filter, is_sortable,
      enum_values, sort_order,
    } = await c.req.json();

    const result = await queries.updateCategoryParam(id, {
      paramKey: param_key,
      displayName: display_name,
      icon,
      paramType: param_type,
      isCore: is_core,
      isFilter: is_filter,
      isSortable: is_sortable,
      enumValues: enum_values,
      sortOrder: sort_order,
    });

    if (!result) {
      return c.json({ code: 404, message: '参数规范不存在' }, 404);
    }

    return c.json({ code: 0, data: result, message: '更新成功' });
  } catch (error: any) {
    if (error.code === '23505') {
      return c.json({ code: 400, message: '该分类下已存在同名参数' }, 400);
    }
    console.error('编辑参数规范失败:', error);
    return c.json({ code: 500, message: '编辑参数规范失败' }, 500);
  }
});

/**
 * 删除参数规范
 * DELETE /api/admin/category-params/:id
 */
categoryParams.delete('/api/admin/category-params/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const result = await queries.deleteCategoryParam(id);

    if (!result) {
      return c.json({ code: 404, message: '参数规范不存在' }, 404);
    }

    return c.json({ code: 0, message: '删除成功' });
  } catch (error) {
    console.error('删除参数规范失败:', error);
    return c.json({ code: 500, message: '删除参数规范失败' }, 500);
  }
});

export default categoryParams;
