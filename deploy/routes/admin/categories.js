"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const auth_js_1 = require("../../middleware/auth.js");
const queries = __importStar(require("../../db/queries.js"));
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
        const allCategories = await queries.getCategories();
        // 构建树形结构
        const rootCategories = allCategories.filter(cat => !cat.parentId);
        const tree = rootCategories.map(root => ({
            ...root,
            children: allCategories.filter(cat => cat.parentId === root.id),
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
        const id = parseInt(c.req.param('id'));
        const category = await queries.getCategoryById(id);
        if (!category) {
            return c.json({ code: 404, message: '分类不存在' }, 404);
        }
        return c.json({ code: 0, data: category });
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
        const result = await queries.createCategory({
            code,
            name,
            displayName: display_name || name,
            icon: icon || null,
            parentId: parent_id || null,
            sortOrder: sort_order || 0,
            isActive: is_active !== false,
        });
        return c.json({ code: 0, data: result, message: '分类创建成功' });
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
        const id = parseInt(c.req.param('id'));
        const { code, name, display_name, icon, parent_id, sort_order, is_active } = await c.req.json();
        const result = await queries.updateCategory(id, {
            code,
            name,
            displayName: display_name,
            icon,
            parentId: parent_id,
            sortOrder: sort_order,
            isActive: is_active,
        });
        if (!result) {
            return c.json({ code: 404, message: '分类不存在' }, 404);
        }
        return c.json({ code: 0, data: result, message: '更新成功' });
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
        const id = parseInt(c.req.param('id'));
        const result = await queries.deleteCategory(id);
        if (!result) {
            return c.json({ code: 404, message: '分类不存在' }, 404);
        }
        return c.json({ code: 0, message: '删除成功' });
    }
    catch (error) {
        console.error('删除分类失败:', error);
        return c.json({ code: 500, message: '删除分类失败' }, 500);
    }
});
exports.default = categories;
