"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../db/index.js");
const search = new hono_1.Hono();
// 获取产品图片（返回 base64）
async function getProductImageUrl(product) {
    // 1. 优先使用 image_id 从 images 表获取
    if (product.image_id) {
        try {
            const imgResult = await index_js_1.pool.query('SELECT image_data, mime_type FROM images WHERE id = $1', [product.image_id]);
            if (imgResult.rows.length > 0 && imgResult.rows[0].image_data) {
                const { image_data, mime_type } = imgResult.rows[0];
                // 过滤过小的图片数据（已损坏/截断的图片可能只有几字节）
                if (image_data.length > 1024) {
                    return `data:${mime_type};base64,${image_data.toString('base64')}`;
                }
                console.warn('图片数据过小，跳过:', product.image_id, image_data.length);
            }
        }
        catch (e) {
            console.error('获取图片失败:', e);
        }
    }
    // 2. 降级：检查 images_binary 字段（旧方式）
    if (product.images_binary && product.images_binary.length > 0 && product.images_binary[0]) {
        return `data:image/jpeg;base64,${product.images_binary[0].toString('base64')}`;
    }
    // 3. 降级：使用 images 数组中的 URL
    if (product.images && product.images.length > 0 && product.images[0]) {
        return product.images[0];
    }
    // 4. 默认图片
    return '';
}
search.get('/api/search', async (c) => {
    const keyword = c.req.query('keyword') || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    console.log('搜索关键词:', keyword);
    // 记录搜索关键词（异步，不阻塞响应）
    if (keyword && keyword.trim()) {
        (0, index_js_1.logSearch)(keyword).catch(err => console.error('记录搜索失败:', err));
    }
    try {
        const result = await (0, index_js_1.searchProducts)(keyword, page, limit);
        // 根据产品类别选择显示标签
        const getTagFields = (params, category) => {
            const tagFields = {
                icebox: ['总容积', '制冷方式', '能效等级'],
                air_condition: ['匹数', '能效等级', '冷暖类型'],
                washer: ['洗涤容量', '能效等级', '变频/定频'],
                gas_water: ['升数', '能效等级', '恒温功能'],
                central_water: ['升数', '能效等级'],
                heater: ['功率', '适用面积'],
                lcd_tv: ['屏幕尺寸', '分辨率', '能效等级'],
                rice_cooker: ['容积', '能效等级', '内胆材质'],
            };
            return tagFields[category] || ['能效等级'];
        };
        // 转换为前端需要的格式
        const products = await Promise.all(result.products.map(async (p) => {
            const tagFields = getTagFields(p.params || {}, p.category || '');
            const tagValues = tagFields.map(field => p.params?.[field] || '').filter(Boolean);
            // 获取图片 URL
            const img = await getProductImageUrl(p);
            return {
                id: p.id,
                title: p.title || p.name,
                img,
                tag: [p.brand, ...tagValues].filter(Boolean),
                brand: p.brand,
                model: p.model,
                price: p.price,
                category: p.category,
                _score: p.rank || 0,
            };
        }));
        return c.json({
            code: 0,
            data: products,
            keyword: keyword, // 返回搜索关键词，便于前端处理
            pagination: {
                page: result.page,
                limit: result.limit,
                total: result.total,
                totalPages: Math.ceil(result.total / result.limit),
            }
        });
    }
    catch (error) {
        console.error('搜索失败:', error);
        return c.json({
            code: -1,
            message: '搜索失败',
            error: error.message
        }, 500);
    }
});
exports.default = search;
