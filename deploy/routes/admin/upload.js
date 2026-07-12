"use strict";
/**
 * 图片上传 API
 */
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
const oss_js_1 = require("../../utils/oss.js");
const queries = __importStar(require("../../db/queries.js"));
const upload = new hono_1.Hono();
// 所有上传路由都需要认证
upload.use('/api/admin/upload/*', auth_js_1.authMiddleware);
upload.use('/api/admin/upload', auth_js_1.authMiddleware);
/**
 * 上传图片
 * POST /api/admin/upload/image
 */
upload.post('/api/admin/upload/image', async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];
        const productId = body['product_id'];
        const imageType = body['image_type'] || 'main';
        const sortOrder = parseInt(body['sort_order'] || '0');
        if (!file) {
            return c.json({ code: 400, message: '请选择要上传的文件' }, 400);
        }
        // 验证文件(大小 + 扩展名 + MIME)
        const validation = (0, oss_js_1.validateImageFile)({
            size: file.size,
            originalName: file.name,
            mimeType: file.type,
        });
        if (!validation.valid) {
            return c.json({ code: 400, message: validation.error }, 400);
        }
        // 读取文件内容
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // 上传到 OSS
        const imageUrl = await (0, oss_js_1.uploadImage)(buffer, file.name, 'products');
        // 如果指定了产品ID，保存到数据库
        if (productId) {
            const image = await queries.createProductImage({
                productId: parseInt(productId),
                imageUrl,
                imageType,
                sortOrder,
            });
            return c.json({
                code: 0,
                data: {
                    id: image.id,
                    url: imageUrl,
                    image_type: imageType,
                    sort_order: sortOrder,
                },
                message: '上传成功',
            });
        }
        // 如果没有产品ID，只返回URL（用于新建产品时）
        return c.json({
            code: 0,
            data: { url: imageUrl },
            message: '上传成功',
        });
    }
    catch (error) {
        console.error('上传图片失败:', error);
        return c.json({ code: 500, message: '上传失败' }, 500);
    }
});
/**
 * 删除图片
 * DELETE /api/admin/upload/image/:id
 */
upload.delete('/api/admin/upload/image/:id', async (c) => {
    try {
        const id = parseInt(c.req.param('id'));
        // 获取图片信息
        const image = await queries.getProductImageById(id);
        if (!image) {
            return c.json({ code: 404, message: '图片不存在' }, 404);
        }
        // 从 OSS 删除文件
        if (image.imageUrl) {
            await (0, oss_js_1.deleteImage)(image.imageUrl);
        }
        // 从数据库删除记录
        await queries.deleteProductImage(id);
        return c.json({ code: 0, message: '删除成功' });
    }
    catch (error) {
        console.error('删除图片失败:', error);
        return c.json({ code: 500, message: '删除失败' }, 500);
    }
});
/**
 * 批量上传图片
 * POST /api/admin/upload/batch
 */
upload.post('/api/admin/upload/batch', async (c) => {
    try {
        const body = await c.req.parseBody();
        const productId = body['product_id'];
        const imageType = body['image_type'] || 'main';
        if (!productId) {
            return c.json({ code: 400, message: '产品ID为必填项' }, 400);
        }
        // 获取所有文件
        const files = [];
        for (const [key, value] of Object.entries(body)) {
            if (key.startsWith('files') && value instanceof File) {
                files.push(value);
            }
        }
        if (files.length === 0) {
            return c.json({ code: 400, message: '请选择要上传的文件' }, 400);
        }
        // 获取当前最大排序号
        const existingImages = await queries.getProductImages(parseInt(productId));
        const maxSortOrder = existingImages.length > 0
            ? Math.max(...existingImages.map(img => img.sortOrder))
            : -1;
        const results = [];
        // 逐个上传
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // 验证文件(大小 + 扩展名 + MIME)
            const validation = (0, oss_js_1.validateImageFile)({
                size: file.size,
                originalName: file.name,
                mimeType: file.type,
            });
            if (!validation.valid) {
                continue; // 跳过无效文件
            }
            // 读取文件内容
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            // 上传到 OSS
            const imageUrl = await (0, oss_js_1.uploadImage)(buffer, file.name, 'products');
            // 保存到数据库
            const image = await queries.createProductImage({
                productId: parseInt(productId),
                imageUrl,
                imageType,
                sortOrder: maxSortOrder + 1 + i,
            });
            results.push({
                id: image.id,
                url: imageUrl,
                image_type: imageType,
                sort_order: maxSortOrder + 1 + i,
            });
        }
        return c.json({
            code: 0,
            data: results,
            message: `成功上传 ${results.length} 张图片`,
        });
    }
    catch (error) {
        console.error('批量上传失败:', error);
        return c.json({ code: 500, message: '上传失败' }, 500);
    }
});
exports.default = upload;
