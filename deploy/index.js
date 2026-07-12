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
app.route('/api/admin', index_js_1.default); // 管理后台 API
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
// 管理后台根路径重定向到登录页（未登录时）
app.get('/admin/', (c) => c.redirect('/admin'));
// 根路径测试
app.get('/', (c) => {
    return c.json({ message: '家电搜索API服务运行中', version: '1.0.1', time: new Date().toISOString() });
});
// FC HTTP 触发器 handler
async function handler(req, resp, context) {
    try {
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers.host || req.headers.Host || '';
        const url = `${protocol}://${host}${req.url || req.path || '/'}`;
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
            if (value !== undefined && value !== null) {
                headers.set(key, String(value));
            }
        }
        const requestInit = {
            method: req.method || 'GET',
            headers,
        };
        if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
            if (req.body !== undefined && req.body !== null) {
                requestInit.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            }
        }
        const request = new Request(url, requestInit);
        const response = await app.fetch(request);
        resp.setStatusCode(response.status);
        const safeHeaders = ['content-type', 'cache-control', 'etag', 'last-modified', 'x-request-id'];
        for (const h of safeHeaders) {
            const val = response.headers.get(h);
            if (val)
                resp.setHeader(h, val);
        }
        const contentType = response.headers.get('content-type');
        if (!contentType) {
            const path = req.url || req.path || '';
            if (path.includes('/api/') || path === '/') {
                resp.setHeader('content-type', 'application/json; charset=utf-8');
            }
            else {
                resp.setHeader('content-type', 'text/plain; charset=utf-8');
            }
        }
        resp.setHeader('content-disposition', 'inline');
        const body = await response.text();
        resp.send(body);
    }
    catch (err) {
        console.error('FC Handler error:', err);
        resp.setStatusCode(500);
        resp.setHeader('content-type', 'application/json; charset=utf-8');
        resp.send(JSON.stringify({
            code: 500,
            error: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
        }));
    }
}
// 本地开发：启动独立 HTTP 服务器
// FC 环境下不启动（由 FC 运行时管理请求）
if (!process.env.FC_FUNC_CODE_PATH) {
    Promise.resolve().then(() => __importStar(require('@hono/node-server'))).then(({ serve }) => {
        const port = 3000;
        const host = '0.0.0.0';
        console.log(`🚀 服务启动在 http://${host}:${port}`);
        serve({
            fetch: app.fetch,
            port,
            hostname: host
        });
    });
}
