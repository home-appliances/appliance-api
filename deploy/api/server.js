"use strict";
/**
 * 本地 JSON API 服务
 * 基于已爬取的家电产品数据
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const logger_1 = require("hono/logger");
const pg_1 = __importDefault(require("pg"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = new hono_1.Hono();
const pool = new pg_1.default.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'appliance_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres123',
});
// 中间件
app.use('*', (0, cors_1.cors)());
app.use('*', (0, logger_1.logger)());
// =====================================================
// 健康检查
// =====================================================
app.get('/', (c) => {
    return c.json({
        message: '家电产品 API 服务',
        version: '1.0.0',
        endpoints: {
            products: '/api/products',
            product: '/api/products/:id',
            brands: '/api/brands',
            search: '/api/search?q=关键词',
            stats: '/api/stats',
        },
    });
});
// =====================================================
// 获取产品列表（支持分页和筛选）
// =====================================================
app.get('/api/products', async (c) => {
    try {
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const brand = c.req.query('brand');
        const search = c.req.query('search');
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        if (brand) {
            query += ` AND brand = $${paramIndex}`;
            params.push(brand);
            paramIndex++;
        }
        if (search) {
            query += ` AND (name ILIKE $${paramIndex} OR model ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        // 获取总数
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);
        // 分页查询
        query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, (page - 1) * limit);
        const result = await pool.query(query, params);
        return c.json({
            success: true,
            data: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// =====================================================
// 获取单个产品详情
// =====================================================
app.get('/api/products/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return c.json({ success: false, error: '产品不存在' }, 404);
        }
        return c.json({ success: true, data: result.rows[0] });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// =====================================================
// 获取品牌列表
// =====================================================
app.get('/api/brands', async (c) => {
    try {
        const result = await pool.query(`
      SELECT brand, COUNT(*) as count
      FROM products
      GROUP BY brand
      ORDER BY count DESC
    `);
        return c.json({ success: true, data: result.rows });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// =====================================================
// 搜索产品
// =====================================================
app.get('/api/search', async (c) => {
    try {
        const q = c.req.query('q');
        if (!q) {
            return c.json({ success: false, error: '请提供搜索关键词' }, 400);
        }
        const result = await pool.query(`
      SELECT * FROM products
      WHERE name ILIKE $1 OR model ILIKE $1 OR brand ILIKE $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [`%${q}%`]);
        return c.json({
            success: true,
            query: q,
            data: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// =====================================================
// 获取统计数据
// =====================================================
app.get('/api/stats', async (c) => {
    try {
        const productCount = await pool.query('SELECT COUNT(*) as count FROM products');
        const imageCount = await pool.query('SELECT COUNT(*) as count FROM images');
        const brandStats = await pool.query(`
      SELECT brand, COUNT(*) as count
      FROM products
      GROUP BY brand
      ORDER BY count DESC
    `);
        return c.json({
            success: true,
            data: {
                totalProducts: parseInt(productCount.rows[0].count),
                totalImages: parseInt(imageCount.rows[0].count),
                brands: brandStats.rows,
            },
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// =====================================================
// 按品牌获取产品
// =====================================================
app.get('/api/brands/:brand/products', async (c) => {
    try {
        const brand = c.req.param('brand');
        const result = await pool.query('SELECT * FROM products WHERE brand = $1 ORDER BY created_at DESC', [brand]);
        return c.json({
            success: true,
            brand,
            data: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// =====================================================
// 按参数筛选产品
// =====================================================
app.get('/api/products/filter', async (c) => {
    try {
        const capacity = c.req.query('capacity');
        const energyLevel = c.req.query('energy');
        const type = c.req.query('type');
        let query = 'SELECT * FROM products WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        if (capacity) {
            query += ` AND params->>'总容积' ILIKE $${paramIndex}`;
            params.push(`%${capacity}%`);
            paramIndex++;
        }
        if (energyLevel) {
            query += ` AND params->>'能效等级' ILIKE $${paramIndex}`;
            params.push(`%${energyLevel}%`);
            paramIndex++;
        }
        if (type) {
            query += ` AND params->>'产品类别' ILIKE $${paramIndex}`;
            params.push(`%${type}%`);
            paramIndex++;
        }
        query += ' ORDER BY created_at DESC LIMIT 100';
        const result = await pool.query(query, params);
        return c.json({
            success: true,
            filters: { capacity, energyLevel, type },
            data: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});
// =====================================================
// 启动服务器
// =====================================================
const port = parseInt(process.env.API_PORT || '3001');
const node_server_1 = require("@hono/node-server");
(0, node_server_1.serve)({
    fetch: app.fetch,
    port,
}, (info) => {
    console.log(`🚀 家电产品 API 服务启动`);
    console.log(`📡 端口: ${info.port}`);
    console.log(`📊 API 文档: http://localhost:${info.port}/`);
    console.log(`🔗 产品列表: http://localhost:${info.port}/api/products`);
    console.log(`🔗 品牌列表: http://localhost:${info.port}/api/brands`);
    console.log(`🔗 搜索: http://localhost:${info.port}/api/search?q=海尔`);
    console.log(`🔗 统计: http://localhost:${info.port}/api/stats`);
});
