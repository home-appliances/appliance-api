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
const hono_1 = require("hono");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_js_1 = require("../../middleware/auth.js");
const queries = __importStar(require("../../db/queries.js"));
const auth = new hono_1.Hono();
/**
 * 管理员登录
 * POST /api/admin/login
 */
auth.post('/api/admin/login', async (c) => {
    try {
        const { username, password } = await c.req.json();
        if (!username || !password) {
            return c.json({ code: 400, message: '用户名和密码不能为空' }, 400);
        }
        // 查询管理员
        const admin = await queries.getAdminByUsername(username);
        if (!admin) {
            return c.json({ code: 401, message: '用户名或密码错误' }, 401);
        }
        if (admin.status !== 'active') {
            return c.json({ code: 403, message: '账号已被禁用' }, 403);
        }
        // 验证密码
        const valid = await bcryptjs_1.default.compare(password, admin.passwordHash);
        if (!valid) {
            return c.json({ code: 401, message: '用户名或密码错误' }, 401);
        }
        // 更新最后登录时间
        await queries.updateAdminLastLogin(admin.id);
        // 记录操作日志
        await queries.createOperationLog({
            adminId: admin.id,
            operator: admin.username,
            ip: c.req.header('x-forwarded-for') || 'unknown',
            type: 'login',
            target: 'admin',
            result: 'success',
        });
        // 生成 Token
        const token = (0, auth_js_1.generateToken)({ id: admin.id, username: admin.username, role: admin.role });
        return c.json({
            code: 0,
            data: {
                token,
                user: {
                    id: admin.id,
                    username: admin.username,
                    name: admin.name,
                    role: admin.role,
                },
            },
            message: '登录成功',
        });
    }
    catch (error) {
        console.error('登录失败:', error);
        return c.json({ code: 500, message: '登录失败' }, 500);
    }
});
/**
 * 获取当前登录用户信息
 * GET /api/admin/me
 */
auth.get('/api/admin/me', auth_js_1.authMiddleware, async (c) => {
    try {
        const adminPayload = c.get('admin');
        const admin = await queries.getAdminById(adminPayload.id);
        if (!admin) {
            return c.json({ code: 404, message: '用户不存在' }, 404);
        }
        return c.json({
            code: 0,
            data: {
                id: admin.id,
                username: admin.username,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                role: admin.role,
                avatar: admin.avatar,
                lastLogin: admin.lastLogin,
            },
        });
    }
    catch (error) {
        console.error('获取用户信息失败:', error);
        return c.json({ code: 500, message: '获取用户信息失败' }, 500);
    }
});
/**
 * 修改密码
 * PUT /api/admin/change-password
 */
auth.put('/api/admin/change-password', auth_js_1.authMiddleware, async (c) => {
    try {
        const adminPayload = c.get('admin');
        const { old_password, new_password } = await c.req.json();
        if (!old_password || !new_password) {
            return c.json({ code: 400, message: '请输入旧密码和新密码' }, 400);
        }
        if (new_password.length < 6) {
            return c.json({ code: 400, message: '新密码长度不能少于6位' }, 400);
        }
        const admin = await queries.getAdminById(adminPayload.id);
        if (!admin) {
            return c.json({ code: 404, message: '用户不存在' }, 404);
        }
        // 验证旧密码
        const valid = await bcryptjs_1.default.compare(old_password, admin.passwordHash);
        if (!valid) {
            return c.json({ code: 401, message: '旧密码错误' }, 401);
        }
        // 更新密码
        const passwordHash = await bcryptjs_1.default.hash(new_password, 10);
        await queries.updateAdmin(admin.id, { passwordHash });
        // 记录操作日志
        await queries.createOperationLog({
            adminId: admin.id,
            operator: admin.username,
            ip: c.req.header('x-forwarded-for') || 'unknown',
            type: 'change_password',
            target: 'admin',
            result: 'success',
        });
        return c.json({ code: 0, message: '密码修改成功' });
    }
    catch (error) {
        console.error('修改密码失败:', error);
        return c.json({ code: 500, message: '修改密码失败' }, 500);
    }
});
exports.default = auth;
