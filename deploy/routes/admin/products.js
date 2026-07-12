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
const products = new hono_1.Hono();
// 所有产品路由都需要认证
products.use('/api/admin/products/*', auth_js_1.authMiddleware);
products.use('/api/admin/products', auth_js_1.authMiddleware);
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
        const categoryId = c.req.query('category_id') ? parseInt(c.req.query('category_id')) : undefined;
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
    }
    catch (error) {
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
        const result = await queries.createProduct({
            name,
            brand,
            categoryId: category_id || null,
            model: model || null,
            price: price || null,
            originalPrice: original_price || null,
            rating: rating || null,
            reviewCount: review_count || 0,
            params: params || {},
            sourcePlatform: 'admin',
        });
        return c.json({ code: 0, data: result, message: '产品创建成功' });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('编辑产品失败:', error);
        return c.json({ code: 500, message: '编辑产品失败' }, 500);
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
    }
    catch (error) {
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
        const deletedCount = await queries.batchDeleteProducts(ids);
        return c.json({
            code: 0,
            message: `成功删除 ${deletedCount} 个产品`,
        });
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('获取品牌列表失败:', error);
        return c.json({ code: 500, message: '获取品牌列表失败' }, 500);
    }
});
exports.default = products;
