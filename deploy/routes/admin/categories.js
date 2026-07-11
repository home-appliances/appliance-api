"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../../db/index.js");
const auth_js_1 = require("../../middleware/auth.js");
const categories = new hono_1.Hono();
// 所有分类路由都需要认证
categories.use('/api/admin/categories/*', auth_js_1.authMiddleware);
categories.use('/api/admin/categories', auth_js_1.authMiddleware);
/**
 * 获取分类列表（树形结构）
 * GET /api/admin/categories
 */
categories.get('/api/admin/categories', async (c) => {
    try {
        const result = await index_js_1.pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count,
        (SELECT COUNT(*) FROM category_params WHERE category_id = c.id) as param_count
      FROM categories c
      ORDER BY c.sort_order, c.name
    `);
        // 构建树形结构
        const rows = result.rows;
        const rootCategories = rows.filter(r => !r.parent_id);
        const tree = rootCategories.map(root => ({
            ...root,
            children: rows.filter(r => r.parent_id === root.id)
        }));
        return c.json({ code: 0, data: tree });
    }
    catch (error) {
        console.error('获取分类列表失败:', error);
        return c.json({ code: 500, message: '获取分类列表失败' }, 500);
    }
});
/**
 * 获取单个分类详情
 * GET /api/admin/categories/:id
 */
categories.get('/api/admin/categories/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const result = await index_js_1.pool.query('SELECT * FROM categories WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '分类不存在' }, 404);
        }
        return c.json({ code: 0, data: result.rows[0] });
    }
    catch (error) {
        console.error('获取分类详情失败:', error);
        return c.json({ code: 500, message: '获取分类详情失败' }, 500);
    }
});
/**
 * 新增分类
 * POST /api/admin/categories
 */
categories.post('/api/admin/categories', async (c) => {
    try {
        const { code, name, display_name, icon, parent_id, sort_order, is_active } = await c.req.json();
        if (!code || !name) {
            return c.json({ code: 400, message: '分类编码和名称为必填项' }, 400);
        }
        const result = await index_js_1.pool.query(`INSERT INTO categories (code, name, display_name, icon, parent_id, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`, [code, name, display_name || name, icon || null, parent_id || null, sort_order || 0, is_active !== false]);
        return c.json({ code: 0, data: result.rows[0], message: '分类创建成功' });
    }
    catch (error) {
        if (error.code === '23505') {
            return c.json({ code: 400, message: '分类编码已存在' }, 400);
        }
        console.error('创建分类失败:', error);
        return c.json({ code: 500, message: '创建分类失败' }, 500);
    }
});
/**
 * 编辑分类
 * PUT /api/admin/categories/:id
 */
categories.put('/api/admin/categories/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const { code, name, display_name, icon, parent_id, sort_order, is_active } = await c.req.json();
        const result = await index_js_1.pool.query(`UPDATE categories
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           display_name = COALESCE($3, display_name),
           icon = COALESCE($4, icon),
           parent_id = $5,
           sort_order = COALESCE($6, sort_order),
           is_active = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING *`, [code, name, display_name, icon, parent_id, sort_order, is_active, id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '分类不存在' }, 404);
        }
        return c.json({ code: 0, data: result.rows[0], message: '更新成功' });
    }
    catch (error) {
        if (error.code === '23505') {
            return c.json({ code: 400, message: '分类编码已存在' }, 400);
        }
        console.error('编辑分类失败:', error);
        return c.json({ code: 500, message: '编辑分类失败' }, 500);
    }
});
/**
 * 删除分类
 * DELETE /api/admin/categories/:id
 */
categories.delete('/api/admin/categories/:id', async (c) => {
    try {
        const id = c.req.param('id');
        // 检查是否有子分类
        const children = await index_js_1.pool.query('SELECT COUNT(*) FROM categories WHERE parent_id = $1', [id]);
        if (parseInt(children.rows[0].count) > 0) {
            return c.json({ code: 400, message: '请先删除子分类' }, 400);
        }
        // 检查是否有产品
        const products = await index_js_1.pool.query('SELECT COUNT(*) FROM products WHERE category_id = $1', [id]);
        if (parseInt(products.rows[0].count) > 0) {
            return c.json({ code: 400, message: '该分类下还有产品，无法删除' }, 400);
        }
        const result = await index_js_1.pool.query('DELETE FROM categories WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            return c.json({ code: 404, message: '分类不存在' }, 404);
        }
        return c.json({ code: 0, message: '删除成功' });
    }
    catch (error) {
        console.error('删除分类失败:', error);
        return c.json({ code: 500, message: '删除分类失败' }, 500);
    }
});
/**
 * 批量更新分类排序
 * PUT /api/admin/categories/batch/sort
 */
categories.put('/api/admin/categories/batch/sort', async (c) => {
    try {
        const { items } = await c.req.json();
        if (!items || !Array.isArray(items)) {
            return c.json({ code: 400, message: '参数错误' }, 400);
        }
        for (const item of items) {
            await index_js_1.pool.query('UPDATE categories SET sort_order = $1 WHERE id = $2', [item.sort_order, item.id]);
        }
        return c.json({ code: 0, message: '排序更新成功' });
    }
    catch (error) {
        console.error('批量更新排序失败:', error);
        return c.json({ code: 500, message: '批量更新排序失败' }, 500);
    }
});
exports.default = categories;
