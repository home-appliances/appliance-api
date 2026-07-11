"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.authMiddleware = authMiddleware;
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
 */
async function authMiddleware(c, next) {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ code: 401, message: '未登录或 Token 无效' }, 401);
    }
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (!payload) {
        return c.json({ code: 401, message: 'Token 已过期' }, 401);
    }
    // 将用户信息存储到 context
    c.set('admin', payload);
    await next();
}
