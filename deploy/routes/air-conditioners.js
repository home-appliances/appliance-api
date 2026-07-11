"use strict";
/**
 * 空调图片 API
 * 访问 ac_images 表（只存图片）
 */
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../db/index.js");
const app = new hono_1.Hono();
// =====================================================
// 获取图片列表（分页 + 筛选）
// =====================================================
app.get('/', async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const brand = c.req.query('brand');
    const keyword = c.req.query('keyword');
    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    if (brand) {
        where += ` AND brand_en = $${paramIndex++}`;
        params.push(brand);
    }
    if (keyword) {
        where += ` AND (product_name ILIKE $${paramIndex} OR uid ILIKE $${paramIndex})`;
        params.push(`%${keyword}%`);
        paramIndex++;
    }
    // 查询总数
    const countResult = await index_js_1.pool.query(`SELECT COUNT(*) FROM ac_images ${where}`, params);
    const total = parseInt(countResult.rows[0].count);
    // 查询数据（不返回图片二进制）
    const query = `
    SELECT id, uid, product_name, brand_en, main_image_url, main_image_size, main_image_type, import_time
    FROM ac_images
    ${where}
    ORDER BY id DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex++}
  `;
    params.push(limit, (page - 1) * limit);
    const result = await index_js_1.pool.query(query, params);
    return c.json({
        success: true,
        data: {
            items: result.rows,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
        },
    });
});
// =====================================================
// 获取单张图片
// =====================================================
app.get('/:id/image', async (c) => {
    const id = c.req.param('id');
    const result = await index_js_1.pool.query('SELECT main_image_data, main_image_type FROM ac_images WHERE id = $1', [id]);
    if (result.rows.length === 0 || !result.rows[0].main_image_data) {
        return c.json({ success: false, message: '图片不存在' }, 404);
    }
    const { main_image_data, main_image_type } = result.rows[0];
    return new Response(main_image_data, {
        headers: {
            'Content-Type': main_image_type || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
        },
    });
});
// =====================================================
// 按 uid 获取图片
// =====================================================
app.get('/uid/:uid/image', async (c) => {
    const uid = c.req.param('uid');
    const result = await index_js_1.pool.query('SELECT main_image_data, main_image_type FROM ac_images WHERE uid = $1', [uid]);
    if (result.rows.length === 0 || !result.rows[0].main_image_data) {
        return c.json({ success: false, message: '图片不存在' }, 404);
    }
    const { main_image_data, main_image_type } = result.rows[0];
    return new Response(main_image_data, {
        headers: {
            'Content-Type': main_image_type || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
        },
    });
});
// =====================================================
// 获取品牌列表
// =====================================================
app.get('/brands/list', async (c) => {
    const result = await index_js_1.pool.query(`
    SELECT brand_en, COUNT(*) as count
    FROM ac_images
    GROUP BY brand_en
    ORDER BY count DESC
  `);
    return c.json({
        success: true,
        data: result.rows,
    });
});
// =====================================================
// 统计信息
// =====================================================
app.get('/stats/summary', async (c) => {
    const [total, withImage, brands] = await Promise.all([
        index_js_1.pool.query('SELECT COUNT(*) FROM ac_images'),
        index_js_1.pool.query('SELECT COUNT(*) FROM ac_images WHERE main_image_data IS NOT NULL'),
        index_js_1.pool.query('SELECT COUNT(DISTINCT brand_en) FROM ac_images'),
    ]);
    return c.json({
        success: true,
        data: {
            total: parseInt(total.rows[0].count),
            with_image: parseInt(withImage.rows[0].count),
            brand_count: parseInt(brands.rows[0].count),
        },
    });
});
exports.default = app;
