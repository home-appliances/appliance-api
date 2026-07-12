"use strict";
/**
 * 阿里云函数计算 (FC 3.0) HTTP 触发器入口
 * 将 FC 的 event/context 转换为 Hono 的 Request/Response
 * 更新时间: 2026-07-02 03:30
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const hono_1 = require("hono");
const cors_1 = require("hono/cors");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const search_js_1 = __importDefault(require("./routes/search.js"));
const detail_js_1 = __importDefault(require("./routes/detail.js"));
const suggest_js_1 = __importDefault(require("./routes/suggest.js"));
const recommend_js_1 = __importDefault(require("./routes/recommend.js"));
const index_js_1 = __importDefault(require("./routes/admin/index.js"));
const routes_js_1 = __importDefault(require("./admin/routes.js"));
const air_conditioners_js_1 = __importDefault(require("./routes/air-conditioners.js"));
const image_proxy_js_1 = __importDefault(require("./routes/image-proxy.js"));
const category_js_1 = __importDefault(require("./routes/category.js"));
const image_js_1 = __importDefault(require("./routes/image.js"));
const app = new hono_1.Hono();
// 全局 CORS 跨域
app.use('*', (0, cors_1.cors)({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization']
}));
// 挂载路由
app.route('/', search_js_1.default);
app.route('/', detail_js_1.default);
app.route('/', suggest_js_1.default);
app.route('/', recommend_js_1.default);
app.route('/', index_js_1.default); // 管理后台 API（路由已含 /api/admin 前缀）
app.route('/admin', routes_js_1.default); // 管理后台 SSR 页面
app.route('/api/air-conditioners', air_conditioners_js_1.default);
app.route('/', image_proxy_js_1.default);
app.route('/', category_js_1.default);
app.route('/', image_js_1.default);
// 管理后台 CSS 静态文件（SSR 页面需要）
app.get('/admin/css/*', async (c) => {
    const cssFile = c.req.path.replace('/admin/css/', '');
    const filePath = path_1.default.join(process.cwd(), 'src', 'admin', 'css', cssFile);
    try {
        const content = fs_1.default.readFileSync(filePath);
        return new Response(content, { headers: { 'content-type': 'text/css; charset=utf-8' } });
    }
    catch {
        return c.text('Not Found', 404);
    }
});
// 管理后台尾斜杠重定向
app.get('/admin/', (c) => c.redirect('/admin'));
// 根路径测试
app.get('/', (c) => {
    return c.json({ message: '家电搜索API服务运行中', version: '1.0.1', time: new Date().toISOString() });
});
/**
 * FC 3.0 HTTP 触发器 handler
 * FC 3.0 使用 event/context 模式，需要返回标准 HTTP 响应对象
 */
async function handler(event, context) {
    try {
        // FC 3.0 HTTP 触发器 event 可能是字符串、Buffer 或对象
        let httpTrigger;
        if (Buffer.isBuffer(event)) {
            httpTrigger = JSON.parse(event.toString('utf-8'));
        }
        else if (typeof event === 'string') {
            httpTrigger = JSON.parse(event);
        }
        else {
            httpTrigger = event;
        }
        // 构建完整的请求 URL
        const protocol = httpTrigger.headers?.['x-forwarded-proto'] || 'https';
        const host = httpTrigger.headers?.host || httpTrigger.headers?.Host || context?.host || 'localhost';
        const rawPath = httpTrigger.rawPath || httpTrigger.path || '/';
        const query = httpTrigger.queryParameters || {};
        const queryString = Object.keys(query).length > 0
            ? '?' + new URLSearchParams(query).toString()
            : '';
        const url = `${protocol}://${host}${rawPath}${queryString}`;
        // 构建 Request headers
        const headers = new Headers();
        if (httpTrigger.headers) {
            for (const [key, value] of Object.entries(httpTrigger.headers)) {
                if (value !== undefined && value !== null) {
                    headers.set(key, String(value));
                }
            }
        }
        // 构建 Request init
        const finalMethod = httpTrigger.httpMethod || httpTrigger.method || httpTrigger.requestContext?.http?.method || 'GET';
        const requestInit = {
            method: finalMethod,
            headers,
        };
        // 处理请求体
        if (httpTrigger.body) {
            let body = typeof httpTrigger.body === 'string'
                ? httpTrigger.body
                : JSON.stringify(httpTrigger.body);
            // FC 3.0 可能对 body 做 base64 编码
            if (httpTrigger.isBase64Encoded) {
                body = Buffer.from(body, 'base64').toString('utf-8');
            }
            requestInit.body = body;
        }
        // 调用 Hono 处理请求
        const request = new Request(url, requestInit);
        const response = await app.fetch(request);
        // 读取响应体
        const responseBody = await response.text();
        // 构建 FC 3.0 标准响应
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });
        responseHeaders['content-disposition'] = 'inline';
        return {
            statusCode: response.status,
            headers: responseHeaders,
            body: responseBody,
        };
    }
    catch (err) {
        console.error('FC Handler error:', err);
        return {
            statusCode: 500,
            headers: {
                'content-type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
                code: 500,
                error: err.message || 'Internal Server Error',
                ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
            }),
        };
    }
}
