"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../db/index.js");
const recommend = new hono_1.Hono();
// 过滤无关图片
const filterImages = (images) => {
    if (!images)
        return [];
    return images.filter(url => url &&
        !url.includes('jingdong.png') &&
        !url.includes('pconline/product/2111/04') &&
        url.startsWith('http'));
};
recommend.get('/api/recommend', async (c) => {
    const limit = parseInt(c.req.query('limit') || '6');
    try {
        const rec = await (0, index_js_1.getRecommendations)(limit);
        // 转换品牌数据
        const brandNameMap = {
            haier: '海尔', midea: '美的', xiaomi: '小米', panasonic: '松下',
            siemens: '西门子', samsung: '三星', lg: 'LG', hisense: '海信',
            casarte: '卡萨帝', electrolux: '伊莱克斯', whirlpool: '惠而浦',
            bocsh: '博世', rongsheng: '容声', tcl: 'TCL', chigo: '志高',
            xinfei: '新飞', mitsubishi: '三菱', aux: '奥克斯',
        };
        const brands = rec.brands.map(b => ({
            brand: b.brand,
            name: brandNameMap[b.brand] || b.brand,
            count: b.count,
        }));
        // 转换产品数据
        const products = rec.hotProducts.map(p => {
            const filteredImages = filterImages(p.images || []);
            return {
                id: p.id,
                title: p.name,
                img: filteredImages[0] || '',
                brand: p.brand,
            };
        });
        return c.json({ code: 0, data: { brands, products } });
    }
    catch (error) {
        console.error('获取推荐失败:', error);
        return c.json({ code: -1, data: { brands: [], products: [] } });
    }
});
exports.default = recommend;
