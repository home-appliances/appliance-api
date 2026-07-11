"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../../db/index.js");
const auth_js_1 = require("../../middleware/auth.js");
const stats = new hono_1.Hono();
// 所有统计路由都需要认证
stats.use('/api/admin/stats/*', auth_js_1.authMiddleware);
/**
 * 数据概览
 * GET /api/admin/stats/overview
 */
stats.get('/api/admin/stats/overview', async (c) => {
    try {
        // 产品总数
        const totalProducts = await index_js_1.pool.query('SELECT COUNT(*) FROM products');
        // 今日新增产品
        const todayNew = await index_js_1.pool.query("SELECT COUNT(*) FROM products WHERE created_at >= CURRENT_DATE");
        // 品牌数量
        const totalBrands = await index_js_1.pool.query('SELECT COUNT(DISTINCT brand) FROM products WHERE brand IS NOT NULL');
        // 品类数量
        const totalCategories = await index_js_1.pool.query('SELECT COUNT(DISTINCT category) FROM products WHERE category IS NOT NULL');
        // 今日搜索次数
        const todaySearches = await index_js_1.pool.query("SELECT COUNT(*) FROM search_logs WHERE created_at >= CURRENT_DATE");
        // 正在运行的爬虫任务
        const runningTasks = await index_js_1.pool.query("SELECT COUNT(*) FROM crawler_tasks WHERE status = 'running'");
        return c.json({
            code: 0,
            data: {
                totalProducts: parseInt(totalProducts.rows[0].count),
                todayNew: parseInt(todayNew.rows[0].count),
                totalBrands: parseInt(totalBrands.rows[0].count),
                totalCategories: parseInt(totalCategories.rows[0].count),
                todaySearches: parseInt(todaySearches.rows[0].count),
                runningTasks: parseInt(runningTasks.rows[0].count),
            },
        });
    }
    catch (error) {
        console.error('获取数据概览失败:', error);
        return c.json({ code: 500, message: '获取数据概览失败' }, 500);
    }
});
/**
 * 品牌统计（TOP10）
 * GET /api/admin/stats/brands
 */
stats.get('/api/admin/stats/brands', async (c) => {
    try {
        const result = await index_js_1.pool.query(`SELECT brand, COUNT(*) as count
       FROM products
       WHERE brand IS NOT NULL
       GROUP BY brand
       ORDER BY count DESC
       LIMIT 10`);
        return c.json({ code: 0, data: result.rows });
    }
    catch (error) {
        console.error('获取品牌统计失败:', error);
        return c.json({ code: 500, message: '获取品牌统计失败' }, 500);
    }
});
/**
 * 品类统计
 * GET /api/admin/stats/categories
 */
stats.get('/api/admin/stats/categories', async (c) => {
    try {
        const result = await index_js_1.pool.query(`SELECT category, COUNT(*) as count
       FROM products
       WHERE category IS NOT NULL
       GROUP BY category
       ORDER BY count DESC`);
        return c.json({ code: 0, data: result.rows });
    }
    catch (error) {
        console.error('获取品类统计失败:', error);
        return c.json({ code: 500, message: '获取品类统计失败' }, 500);
    }
});
/**
 * 搜索热词统计（TOP10）
 * GET /api/admin/stats/search
 */
stats.get('/api/admin/stats/search', async (c) => {
    try {
        const result = await index_js_1.pool.query(`SELECT keyword, COUNT(*) as count
       FROM search_logs
       GROUP BY keyword
       ORDER BY count DESC
       LIMIT 10`);
        return c.json({ code: 0, data: result.rows });
    }
    catch (error) {
        console.error('获取搜索统计失败:', error);
        return c.json({ code: 500, message: '获取搜索统计失败' }, 500);
    }
});
/**
 * 最近7天搜索趋势
 * GET /api/admin/stats/search-trend
 */
stats.get('/api/admin/stats/search-trend', async (c) => {
    try {
        const result = await index_js_1.pool.query(`SELECT DATE(created_at) as date, COUNT(*) as count
       FROM search_logs
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date`);
        return c.json({ code: 0, data: result.rows });
    }
    catch (error) {
        console.error('获取搜索趋势失败:', error);
        return c.json({ code: 500, message: '获取搜索趋势失败' }, 500);
    }
});
exports.default = stats;
