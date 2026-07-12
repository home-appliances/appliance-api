"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.authMiddleware = authMiddleware;
exports.superAdminMiddleware = superAdminMiddleware;
const cookie_1 = require("hono/cookie");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'jd-appliance-admin-secret-key-2024';
/**
 * 生成 JWT Token
 */
function generateToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
/**
 * 验证 Token
 */
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
/**
 * 认证中间件
 * 支持两种方式:
 * 1. Authorization: Bearer <token> (API 客户端, 如小程序)
 * 2. Cookie: admin_token=<token> (后台 SSR 页面, 浏览器自动携带)
 */
async function authMiddleware(c, next) {
    // 1. 优先读 Authorization header
    let token;
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    // 2. 没有则读 Cookie (后台页面登录后设置的 admin_token)
    if (!token) {
        token = (0, cookie_1.getCookie)(c, 'admin_token');
    }
    if (!token) {
        return c.json({ code: 401, message: '未登录或 Token 无效' }, 401);
    }
    const payload = verifyToken(token);
    if (!payload) {
        return c.json({ code: 401, message: 'Token 已过期' }, 401);
    }
    // 将用户信息存储到 context
    c.set('admin', payload);
    await next();
}
/**
 * 超级管理员权限中间件
 */
async function superAdminMiddleware(c, next) {
    const admin = c.get('admin');
    if (!admin || admin.role !== 'super_admin') {
        return c.json({ code: 403, message: '权限不足，需要超级管理员权限' }, 403);
    }
    await next();
}
