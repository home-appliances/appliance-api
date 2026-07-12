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
const users = new hono_1.Hono();
// 所有用户路由都需要超级管理员权限
users.use('/api/admin/users/*', auth_js_1.authMiddleware, auth_js_1.superAdminMiddleware);
users.use('/api/admin/users', auth_js_1.authMiddleware, auth_js_1.superAdminMiddleware);
/**
 * 获取用户列表
 * GET /api/admin/users
 */
users.get('/api/admin/users', async (c) => {
    try {
        const admins = await queries.getAdmins();
        return c.json({ code: 0, data: admins });
    }
    catch (error) {
        console.error('获取用户列表失败:', error);
        return c.json({ code: 500, message: '获取用户列表失败' }, 500);
    }
});
/**
 * 新增用户
 * POST /api/admin/users
 */
users.post('/api/admin/users', async (c) => {
    try {
        const { username, password, name, email, phone, role } = await c.req.json();
        if (!username || !password) {
            return c.json({ code: 400, message: '用户名和密码不能为空' }, 400);
        }
        // 检查用户名是否已存在
        const existing = await queries.getAdminByUsername(username);
        if (existing) {
            return c.json({ code: 400, message: '用户名已存在' }, 400);
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const result = await queries.createAdmin({
            username,
            passwordHash,
            name: name || null,
            email: email || null,
            phone: phone || null,
            role: role || 'admin',
            status: 'active',
        });
        return c.json({ code: 0, data: result, message: '用户创建成功' });
    }
    catch (error) {
        console.error('创建用户失败:', error);
        return c.json({ code: 500, message: '创建用户失败' }, 500);
    }
});
/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
users.get('/api/admin/users/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = await queries.getAdminById(id);
        if (!user) {
            return c.json({ code: 404, message: '用户不存在' }, 404);
        }
        return c.json({ code: 0, data: user });
    }
    catch (error) {
        console.error('获取用户详情失败:', error);
        return c.json({ code: 500, message: '获取用户详情失败' }, 500);
    }
});
/**
 * 编辑用户
 * PUT /api/admin/users/:id
 */
users.put('/api/admin/users/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const { name, email, phone, role, password } = await c.req.json();
        const updateData = {
            name: name || null,
            email: email || null,
            phone: phone || null,
            role: role || 'admin',
        };
        // 如果提供了新密码，也更新密码
        if (password) {
            updateData.passwordHash = await bcryptjs_1.default.hash(password, 10);
        }
        const result = await queries.updateAdmin(id, updateData);
        if (!result) {
            return c.json({ code: 404, message: '用户不存在' }, 404);
        }
        return c.json({ code: 0, data: result, message: '更新成功' });
    }
    catch (error) {
        console.error('编辑用户失败:', error);
        return c.json({ code: 500, message: '编辑用户失败' }, 500);
    }
});
/**
 * 切换用户状态
 * PUT /api/admin/users/:id/toggle-status
 */
users.put('/api/admin/users/:id/toggle-status', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = await queries.getAdminById(id);
        if (!user) {
            return c.json({ code: 404, message: '用户不存在' }, 404);
        }
        const newStatus = user.status === 'active' ? 'disabled' : 'active';
        const result = await queries.updateAdmin(id, { status: newStatus });
        return c.json({ code: 0, data: result, message: '状态更新成功' });
    }
    catch (error) {
        console.error('切换用户状态失败:', error);
        return c.json({ code: 500, message: '切换用户状态失败' }, 500);
    }
});
/**
 * 删除用户（软删除）
 * DELETE /api/admin/users/:id
 */
users.delete('/api/admin/users/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const user = await queries.getAdminById(id);
        if (!user) {
            return c.json({ code: 404, message: '用户不存在' }, 404);
        }
        // 软删除：标记为 deleted 状态
        await queries.updateAdmin(id, {
            status: 'deleted',
            username: `${user.username}_deleted_${id}`,
        });
        return c.json({ code: 0, message: '删除成功' });
    }
    catch (error) {
        console.error('删除用户失败:', error);
        return c.json({ code: 500, message: '删除用户失败' }, 500);
    }
});
exports.default = users;
