"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const index_js_1 = require("../db/index.js");
const suggest = new hono_1.Hono();
suggest.get('/api/suggest', async (c) => {
    const keyword = c.req.query('keyword') || '';
    const limit = parseInt(c.req.query('limit') || '8');
    try {
        const suggestions = await (0, index_js_1.getSuggestions)(keyword, limit);
        return c.json({ code: 0, data: suggestions });
    }
    catch (error) {
        console.error('获取搜索建议失败:', error);
        return c.json({ code: -1, data: [] });
    }
});
exports.default = suggest;
