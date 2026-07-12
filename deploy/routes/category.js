"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../db/index.js");
const category = new hono_1.Hono();
// 获取所有分类
category.get('/api/categories', async (c) => {
    try {
        const categories = await (0, index_js_1.getCategories)();
        // 构建树形结构
        const rootCategories = categories.filter(cat => !cat.parent_id);
        const tree = rootCategories.map(root => ({
            ...root,
            children: categories.filter(cat => cat.parent_id === root.id)
        }));
        return c.json({
            code: 0,
            data: tree,
            total: categories.length
        });
    }
    catch (error) {
        console.error('获取分类失败:', error);
        return c.json({
            code: -1,
            message: '获取分类失败',
            error: error.message
        }, 500);
    }
});
// 获取单个分类详情及其产品
category.get('/api/category/:id', async (c) => {
    const categoryId = parseInt(c.req.param('id'));
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    try {
        const result = await (0, index_js_1.getProductsByCategoryId)(categoryId, page, limit);
        // 获取分类信息
        const categories = await (0, index_js_1.getCategories)();
        const categoryInfo = categories.find(cat => cat.id === categoryId);
        if (!categoryInfo) {
            return c.json({
                code: -1,
                message: '分类不存在'
            }, 404);
        }
        // 处理产品图片
        const products = result.products.map(p => {
            let img = '/static/default_img.png';
            if (p.image_id) {
                // 图片从 images 表获取，这里先用占位符
                // 实际应该调用 getProductImagesList
                img = '/static/default_img.png';
            }
            else if (p.images && p.images.length > 0 && p.images[0]) {
                img = p.images[0];
            }
            return {
                id: p.id,
                title: p.name,
                img: img,
                tag: [p.brand, p.params?.['能效等级']].filter(Boolean),
                brand: p.brand,
                model: p.model,
                price: p.price,
                category: p.category,
            };
        });
        return c.json({
            code: 0,
            data: {
                category: categoryInfo,
                products: products
            },
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / result.limit),
            }
        });
    }
    catch (error) {
        console.error('获取分类产品失败:', error);
        return c.json({
            code: -1,
            message: '获取分类产品失败',
            error: error.message
        }, 500);
    }
});
exports.default = category;
