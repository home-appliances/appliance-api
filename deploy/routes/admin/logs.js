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
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const auth_js_1 = require("../../middleware/auth.js");
const queries = __importStar(require("../../db/queries.js"));
const logs = new hono_1.Hono();
logs.use('/api/admin/logs/*', auth_js_1.authMiddleware);
logs.use('/api/admin/logs', auth_js_1.authMiddleware);
/**
 * 获取操作日志列表
 * GET /api/admin/logs?page=1&limit=20
 */
logs.get('/api/admin/logs', async (c) => {
    try {
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const result = await queries.getOperationLogs(page, limit);
        return c.json({
            code: 0,
            data: {
                list: result.logs,
                pagination: {
                    page: result.page,
                    limit: result.limit,
                    total: result.total,
                    totalPages: Math.ceil(result.total / result.limit),
                },
            },
        });
    }
    catch (error) {
        console.error('获取操作日志失败:', error);
        return c.json({ code: 500, message: '获取操作日志失败' }, 500);
    }
});
/**
 * 删除单条日志（仅超级管理员）
 * DELETE /api/admin/logs/:id
 */
logs.delete('/api/admin/logs/:id', auth_js_1.authMiddleware, auth_js_1.superAdminMiddleware, async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        const result = await queries.deleteOperationLog(id);
        if (!result) {
            return c.json({ code: 404, message: '日志不存在' }, 404);
        }
        return c.json({ code: 0, message: '删除成功' });
    }
    catch (error) {
        console.error('删除日志失败:', error);
        return c.json({ code: 500, message: '删除日志失败' }, 500);
    }
});
/**
 * 清空所有日志（仅超级管理员）
 * DELETE /api/admin/logs
 */
logs.delete('/api/admin/logs', auth_js_1.authMiddleware, auth_js_1.superAdminMiddleware, async (c) => {
    try {
        await queries.clearOperationLogs();
        return c.json({ code: 0, message: '日志已清空' });
    }
    catch (error) {
        console.error('清空日志失败:', error);
        return c.json({ code: 500, message: '清空日志失败' }, 500);
    }
});
exports.default = logs;
