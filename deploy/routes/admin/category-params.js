"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../../db/index.js");
const auth_js_1 = require("../../middleware/auth.js");
const categoryParams = new hono_1.Hono();
// 所有路由都需要认证
categoryParams.use('/api/admin/category-params/*', auth_js_1.authMiddleware);
categoryParams.use('/api/admin/category-params', auth_js_1.authMiddleware);
/**
 * 获取某分类的参数规范列表
 * GET /api/admin/category-params?category_id=xxx
 */
categoryParams.get('/api/admin/category-params', async (c) => {
    try {
        const categoryId = c.req.query('category_id');
        let query = `
      SELECT cp.*, c.name as category_name, c.code as category_code
      FROM category_params cp
      LEFT JOIN categories c ON c.id = cp.category_id
    `;
        const params = [];
        if (categoryId) {
            query += ' WHERE cp.category_id = $1';
            params.push(categoryId);
        }
        query += ' ORDER BY cp.category_id, cp.sort_order';
        const result = await index_js_1.pool.query(query, params);
        return c.json({ code: 0, data: result.rows });
    }
    catch (error) {
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
        const id = c.req.param('id');
        const result = await index_js_1.pool.query('SELECT * FROM category_params WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '参数规范不存在' }, 404);
        }
        return c.json({ code: 0, data: result.rows[0] });
    }
    catch (error) {
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
        const { category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order } = await c.req.json();
        if (!category_id || !param_key || !display_name) {
            return c.json({ code: 400, message: '分类ID、参数名和显示名为必填项' }, 400);
        }
        const result = await index_js_1.pool.query(`INSERT INTO category_params (category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`, [
            category_id, param_key, display_name, icon || null,
            param_type || 'text', is_core || false, is_filter || false, is_sortable || false,
            enum_values ? JSON.stringify(enum_values) : null, sort_order || 0
        ]);
        return c.json({ code: 0, data: result.rows[0], message: '参数规范创建成功' });
    }
    catch (error) {
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
        const id = c.req.param('id');
        const { param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order } = await c.req.json();
        const result = await index_js_1.pool.query(`UPDATE category_params
       SET param_key = COALESCE($1, param_key),
           display_name = COALESCE($2, display_name),
           icon = $3,
           param_type = COALESCE($4, param_type),
           is_core = COALESCE($5, is_core),
           is_filter = COALESCE($6, is_filter),
           is_sortable = COALESCE($7, is_sortable),
           enum_values = $8,
           sort_order = COALESCE($9, sort_order)
       WHERE id = $10
       RETURNING *`, [param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values ? JSON.stringify(enum_values) : null, sort_order, id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '参数规范不存在' }, 404);
        }
        return c.json({ code: 0, data: result.rows[0], message: '更新成功' });
    }
    catch (error) {
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
        const id = c.req.param('id');
        const result = await index_js_1.pool.query('DELETE FROM category_params WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '参数规范不存在' }, 404);
        }
        return c.json({ code: 0, message: '删除成功' });
    }
    catch (error) {
        console.error('删除参数规范失败:', error);
        return c.json({ code: 500, message: '删除参数规范失败' }, 500);
    }
});
/**
 * 批量更新排序
 * PUT /api/admin/category-params/batch/sort
 */
categoryParams.put('/api/admin/category-params/batch/sort', async (c) => {
    try {
        const { items } = await c.req.json();
        if (!items || !Array.isArray(items)) {
            return c.json({ code: 400, message: '参数错误' }, 400);
        }
        for (const item of items) {
            await index_js_1.pool.query('UPDATE category_params SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
        }
        return c.json({ code: 0, message: '排序更新成功' });
    }
    catch (error) {
        console.error('批量更新排序失败:', error);
        return c.json({ code: 500, message: '批量更新排序失败' }, 500);
    }
});
exports.default = categoryParams;
