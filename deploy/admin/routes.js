"use strict";
/**
 * 管理后台 SSR 路由
 * 用服务端渲染替代静态文件
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const hono_1 = require("hono");
const cookie_1 = require("hono/cookie");
const index_js_1 = require("../db/index.js");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const middleware_js_1 = require("./middleware.js");
const admin = new hono_1.Hono();
const login_js_1 = require("./pages/login.js");
const dashboard_js_1 = require("./pages/dashboard.js");
const users_js_1 = require("./pages/users.js");
const products_js_1 = require("./pages/products.js");
const categories_js_1 = require("./pages/categories.js");
const category_params_js_1 = require("./pages/category-params.js");
const product_images_js_1 = require("./pages/product-images.js");
const logs_js_1 = require("./pages/logs.js");
// ==================== 登录 ====================
// 登录页
admin.get('/login', async (c) => {
    return c.html((0, login_js_1.loginPage)());
});
// 登录处理
admin.post('/login', async (c) => {
    try {
        const body = await c.req.parseBody();
        const username = body.username;
        const password = body.password;
        if (!username || !password) {
            return c.html((0, login_js_1.loginPage)('请输入用户名和密码'));
        }
        const result = await index_js_1.pool.query('SELECT * FROM admins WHERE username = $1 AND status = $2', [username, 'active']);
        if (result.rows.length === 0) {
            return c.html((0, login_js_1.loginPage)('用户名或密码错误'));
        }
        const adminUser = result.rows[0];
        const valid = await bcryptjs_1.default.compare(password, adminUser.password_hash);
        if (!valid) {
            return c.html((0, login_js_1.loginPage)('用户名或密码错误'));
        }
        // 更新最后登录时间
        await index_js_1.pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [adminUser.id]);
        // 记录操作日志
        await index_js_1.pool.query('INSERT INTO operation_logs (admin_id, operator, ip, type, target, result) VALUES ($1, $2, $3, $4, $5, $6)', [adminUser.id, adminUser.username, c.req.header('x-forwarded-for') || 'unknown', 'login', 'admin', 'success']);
        // 生成 Token 并设置 Cookie
        const token = (0, middleware_js_1.generateToken)({ id: adminUser.id, username: adminUser.username, role: adminUser.role });
        (0, cookie_1.setCookie)(c, 'admin_token', token, {
            path: '/admin',
            httpOnly: true,
            maxAge: 86400, // 24 小时
            sameSite: 'Lax',
        });
        return c.redirect('/admin/');
    }
    catch (error) {
        console.error('登录失败:', error);
        return c.html((0, login_js_1.loginPage)('登录失败，请稍后重试'));
    }
});
// 退出登录
admin.get('/logout', async (c) => {
    (0, cookie_1.deleteCookie)(c, 'admin_token', { path: '/admin' });
    return c.redirect('/admin/login');
});
// ==================== 仪表盘 ====================
admin.get('/', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    try {
        const [products, brands, categories, searches] = await Promise.all([
            index_js_1.pool.query('SELECT COUNT(*) FROM products WHERE deleted_at IS NULL'),
            index_js_1.pool.query('SELECT COUNT(DISTINCT brand) FROM products WHERE deleted_at IS NULL'),
            index_js_1.pool.query('SELECT COUNT(*) FROM categories'),
            index_js_1.pool.query('SELECT COUNT(*) FROM search_logs'),
        ]);
        return c.html((0, dashboard_js_1.dashboardPage)({
            totalProducts: parseInt(products.rows[0].count),
            totalBrands: parseInt(brands.rows[0].count),
            totalCategories: parseInt(categories.rows[0].count),
            totalSearches: parseInt(searches.rows[0].count),
        }, role));
    }
    catch (error) {
        return c.html((0, dashboard_js_1.dashboardPage)({ totalProducts: 0, totalBrands: 0, totalCategories: 0, totalSearches: 0 }, role));
    }
});
// ==================== 用户管理（仅超级管理员）====================
// 用户列表
admin.get('/users', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const result = await index_js_1.pool.query("SELECT id, username, name, email, phone, role, status, created_at, last_login FROM admins WHERE status != 'deleted' ORDER BY id");
    return c.html((0, users_js_1.usersPage)(result.rows, role));
});
// 新增用户页面
admin.get('/users/create', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    return c.html((0, users_js_1.userFormPage)(undefined, undefined, role));
});
// 新增用户处理
admin.post('/users/create', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    try {
        const adminUser = c.get('admin');
        const currentRole = adminUser?.role || 'admin';
        const body = await c.req.parseBody();
        const { username, password, name, email, phone, role } = body;
        if (!username || !password) {
            return c.html((0, users_js_1.userFormPage)(undefined, '用户名和密码不能为空', currentRole));
        }
        const exists = await index_js_1.pool.query('SELECT id FROM admins WHERE username = $1', [username]);
        if (exists.rows.length > 0) {
            return c.html((0, users_js_1.userFormPage)(undefined, '用户名已存在', currentRole));
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        await index_js_1.pool.query('INSERT INTO admins (username, password_hash, name, email, phone, role, status) VALUES ($1, $2, $3, $4, $5, $6, $7)', [username, passwordHash, name || null, email || null, phone || null, role || 'admin', 'active']);
        return c.redirect('/admin/users');
    }
    catch (error) {
        const adminUser = c.get('admin');
        const currentRole = adminUser?.role || 'admin';
        return c.html((0, users_js_1.userFormPage)(undefined, '创建失败: ' + error.message, currentRole));
    }
});
// 编辑用户页面
admin.get('/users/:id/edit', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const currentRole = adminUser?.role || 'admin';
    const id = c.req.param('id');
    const result = await index_js_1.pool.query('SELECT * FROM admins WHERE id = $1', [id]);
    if (result.rows.length === 0)
        return c.redirect('/admin/users');
    return c.html((0, users_js_1.userFormPage)(result.rows[0], undefined, currentRole));
});
// 编辑用户处理
admin.post('/users/:id/edit', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    try {
        const adminUser = c.get('admin');
        const currentRole = adminUser?.role || 'admin';
        const id = c.req.param('id');
        const body = await c.req.parseBody();
        const { name, email, phone, role } = body;
        await index_js_1.pool.query('UPDATE admins SET name=$1, email=$2, phone=$3, role=$4, updated_at=NOW() WHERE id=$5', [name || null, email || null, phone || null, role || 'admin', id]);
        return c.redirect('/admin/users');
    }
    catch (error) {
        const adminUser = c.get('admin');
        const currentRole = adminUser?.role || 'admin';
        return c.html((0, users_js_1.userFormPage)(undefined, '更新失败: ' + error.message, currentRole));
    }
});
// 切换用户状态
admin.post('/users/:id/toggle-status', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    const id = c.req.param('id');
    const result = await index_js_1.pool.query('SELECT status FROM admins WHERE id = $1', [id]);
    if (result.rows.length > 0) {
        const newStatus = result.rows[0].status === 'active' ? 'disabled' : 'active';
        await index_js_1.pool.query('UPDATE admins SET status=$1, updated_at=NOW() WHERE id=$2', [newStatus, id]);
    }
    return c.redirect('/admin/users');
});
// 删除用户
admin.post('/users/:id/delete', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    const id = c.req.param('id');
    // 先检查用户是否已经是删除状态，避免重复追加 _deleted_
    const result = await index_js_1.pool.query('SELECT status FROM admins WHERE id = $1', [id]);
    if (result.rows.length > 0 && result.rows[0].status !== 'deleted') {
        await index_js_1.pool.query("UPDATE admins SET status='deleted', username=username || '_deleted_' || id WHERE id=$1", [id]);
    }
    return c.redirect('/admin/users');
});
// ==================== 产品管理 ====================
admin.get('/products', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = 20;
    const offset = (page - 1) * pageSize;
    // 获取搜索和筛选参数
    const keyword = c.req.query('keyword') || '';
    const brandFilter = c.req.query('brand') || '';
    const categoryFilter = c.req.query('category') || '';
    // 构建查询条件
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    // 品牌别名映射（与数据库搜索保持一致）
    const brandNameMap = {
        '小米': 'xiaomi', '海尔': 'haier', '美的': 'midea', '松下': 'panasonic',
        '西门子': 'siemens', '三星': 'samsung', '海信': 'hisense', '容声': 'rongsheng',
        '卡萨帝': 'casarte', '伊莱克斯': 'electrolux', '惠而浦': 'whirlpool',
        '博世': 'bocsh', 'TCL': 'tcl', '志高': 'chigo', '新飞': 'xinfei',
        '三菱': 'mitsubishi', '奥克斯': 'aux', 'LG': 'lg',
        '格力': 'gree', '大金': 'daikin', '科龙': 'kelon',
        '小天鹅': 'little_swan',
        '林内': 'noritz', '能率': 'noritz', 'A.O.史密斯': 'a/o_smith', '史密斯': 'a/o_smith',
        '万和': 'macro', '万家乐': 'macro', '阿里斯顿': 'ariston',
        '索尼': 'sony', '夏普': 'sharp', '飞利浦': 'philips', '长虹': 'changhong',
        '康佳': 'konka', '乐视': 'letv', '华为': 'huawei',
        '老板': 'robam', '方太': 'fotile', '华帝': 'vatti',
    };
    // 反向映射：英文品牌名 → 中文品牌名
    const brandEnglishToChinese = {};
    Object.entries(brandNameMap).forEach(([cn, en]) => {
        brandEnglishToChinese[en] = cn;
    });
    // 分类词 → category 字段映射
    const categoryKeywordMap = {
        '冰箱': 'icebox', '冰柜': 'icebox', '冷柜': 'icebox',
        '空调': 'air_condition', '柜机': 'air_condition', '挂机': 'air_condition',
        '洗衣机': 'washer', '滚筒': 'washer', '波轮': 'washer',
        '热水器': 'gas_water', '燃气热水器': 'gas_water', '电热水器': 'gas_water', '空气能': 'central_water',
        '电视': 'lcd_tv', '液晶电视': 'lcd_tv', '智能电视': 'lcd_tv',
        '取暖器': 'heater', '暖风机': 'heater', '油汀': 'heater',
        '电饭煲': 'rice_cooker', '电饭锅': 'rice_cooker', '油烟机': 'rice_cooker',
    };
    // 关键词搜索（支持品牌别名 + 多关键词拆分 + 分类词匹配 category）
    if (keyword) {
        const lowerKeyword = keyword.toLowerCase().trim();
        // 拆分关键词：用空格分隔，或按已知品牌名/分类词拆分
        const splitWords = [
            // 品牌名
            ...Object.keys(brandNameMap),
            ...Object.values(brandNameMap),
            ...Object.values(brandEnglishToChinese),
            // 分类词
            ...Object.keys(categoryKeywordMap),
            // 规格词
            '1匹', '1.5匹', '2匹', '3匹', '5匹', '大1匹', '大1.5匹', '大2匹', '大3匹',
        ].sort((a, b) => b.length - a.length); // 按长度降序
        let parts = [];
        if (keyword.includes(' ')) {
            parts = keyword.split(/\s+/).filter(t => t.length > 0);
        }
        else {
            let remaining = keyword.trim();
            while (remaining.length > 0) {
                let matched = false;
                for (const word of splitWords) {
                    if (remaining.startsWith(word)) {
                        parts.push(word);
                        remaining = remaining.substring(word.length);
                        matched = true;
                        break;
                    }
                }
                if (!matched)
                    break;
            }
            if (parts.length === 0 || remaining.length > 0) {
                parts = [keyword.trim()];
            }
        }
        // 对每个关键词部分构建匹配条件，整体用 AND 连接
        for (const part of parts) {
            const partConditions = [];
            const partLower = part.toLowerCase().trim();
            // 原始关键词匹配 name/brand/model
            partConditions.push(`(p.name ILIKE $${paramIndex} OR p.brand ILIKE $${paramIndex} OR p.model ILIKE $${paramIndex})`);
            params.push(`%${part}%`);
            paramIndex++;
            // 分类词匹配 category 字段
            const mappedCategory = categoryKeywordMap[part] || categoryKeywordMap[partLower];
            if (mappedCategory) {
                partConditions.push(`p.category = $${paramIndex}`);
                params.push(mappedCategory);
                paramIndex++;
            }
            // 中文品牌名 → 英文品牌名
            const mappedEn = brandNameMap[partLower] || brandNameMap[part.trim()];
            if (mappedEn) {
                partConditions.push(`p.brand ILIKE $${paramIndex}`);
                params.push(`%${mappedEn}%`);
                paramIndex++;
            }
            // 英文品牌名 → 中文品牌名
            const mappedCn = brandEnglishToChinese[partLower];
            if (mappedCn) {
                partConditions.push(`p.brand ILIKE $${paramIndex}`);
                params.push(`%${mappedCn}%`);
                paramIndex++;
            }
            conditions.push(`(${partConditions.join(' OR ')})`);
        }
    }
    // 品牌筛选
    if (brandFilter) {
        conditions.push(`p.brand = $${paramIndex}`);
        params.push(brandFilter);
        paramIndex++;
    }
    // 分类筛选
    if (categoryFilter) {
        conditions.push(`p.category = $${paramIndex}`);
        params.push(categoryFilter);
        paramIndex++;
    }
    // 尝试过滤已删除的产品（如果 deleted_at 字段存在）
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    let products, count;
    try {
        // 先尝试带 deleted_at 条件
        const deletedWhere = conditions.length > 0
            ? `WHERE p.deleted_at IS NULL AND ${conditions.join(' AND ')}`
            : 'WHERE p.deleted_at IS NULL';
        [products, count] = await Promise.all([
            index_js_1.pool.query(`SELECT p.id, p.name as title, p.brand, p.model, p.category, p.created_at,
                COALESCE(p.images[1], i.source_url) as image_url
         FROM products p
         LEFT JOIN images i ON p.image_id = i.id
         ${deletedWhere}
         ORDER BY p.id DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...params, pageSize, offset]),
            index_js_1.pool.query(`SELECT COUNT(*) FROM products p ${deletedWhere}`, params),
        ]);
    }
    catch {
        // 如果 deleted_at 字段不存在，查询所有产品
        [products, count] = await Promise.all([
            index_js_1.pool.query(`SELECT p.id, p.name as title, p.brand, p.model, p.category, p.created_at,
                COALESCE(p.images[1], i.source_url) as image_url
         FROM products p
         LEFT JOIN images i ON p.image_id = i.id
         ${whereClause}
         ORDER BY p.id DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`, [...params, pageSize, offset]),
            index_js_1.pool.query(`SELECT COUNT(*) FROM products p ${whereClause}`, params),
        ]);
    }
    // 获取品牌列表（用于筛选下拉框，排除已删除产品和无意义品牌）
    let brandsResult;
    try {
        brandsResult = await index_js_1.pool.query("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND deleted_at IS NULL AND brand != '' ORDER BY brand");
    }
    catch {
        brandsResult = await index_js_1.pool.query("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' ORDER BY brand");
    }
    const brands = brandsResult.rows.map((r) => r.brand);
    return c.html((0, products_js_1.productsPage)(products.rows, page, parseInt(count.rows[0].count), pageSize, role, { keyword, brand: brandFilter, category: categoryFilter }, brands));
});
// 新增产品页面
admin.get('/products/create', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    return c.html((0, products_js_1.productFormPage)(undefined, undefined, role));
});
// 新增产品处理
admin.post('/products/create', middleware_js_1.authMiddleware, async (c) => {
    try {
        const adminUser = c.get('admin');
        const role = adminUser?.role || 'admin';
        const body = await c.req.parseBody();
        const { name, brand, model, category, price, image_url, description, params_count } = body;
        if (!name) {
            return c.html((0, products_js_1.productFormPage)(undefined, '产品名称不能为空', role));
        }
        const images = image_url ? [image_url] : [];
        // 收集参数
        const params = {};
        if (description)
            params.description = description;
        const count = parseInt(params_count || '0');
        for (let i = 0; i < count; i++) {
            const key = body[`param_key_${i}`];
            const value = body[`param_value_${i}`];
            if (key && value)
                params[key] = value;
        }
        await index_js_1.pool.query(`INSERT INTO products (name, brand, model, category, price, images, params, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`, [name, brand || '未知品牌', model || null, category || null, price ? parseFloat(price) : null, images, JSON.stringify(params)]);
        return c.redirect('/admin/products');
    }
    catch (error) {
        const adminUser = c.get('admin');
        const role = adminUser?.role || 'admin';
        return c.html((0, products_js_1.productFormPage)(undefined, '创建失败: ' + error.message, role));
    }
});
// 编辑产品页面
admin.get('/products/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const id = c.req.param('id');
    const result = await index_js_1.pool.query(`SELECT p.*, i.source_url as image_source_url
     FROM products p
     LEFT JOIN images i ON p.image_id = i.id
     WHERE p.id = $1`, [id]);
    if (result.rows.length === 0)
        return c.redirect('/admin/products');
    const product = result.rows[0];
    // 如果 images 数组为空但有 image_id，使用 images 表的 source_url
    if ((!product.images || product.images.length === 0) && product.image_source_url) {
        product.images = [product.image_source_url];
    }
    return c.html((0, products_js_1.productFormPage)(product, undefined, role));
});
// 编辑产品处理
admin.post('/products/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    try {
        const adminUser = c.get('admin');
        const role = adminUser?.role || 'admin';
        const id = c.req.param('id');
        const body = await c.req.parseBody();
        const { name, brand, model, category, price, image_url, description, params_count } = body;
        if (!name) {
            return c.html((0, products_js_1.productFormPage)({ id, name, brand, model, category, price, images: image_url ? [image_url] : [] }, '产品名称不能为空', role));
        }
        const images = image_url ? [image_url] : [];
        // 收集参数
        const params = {};
        if (description)
            params.description = description;
        const count = parseInt(params_count || '0');
        for (let i = 0; i < count; i++) {
            const key = body[`param_key_${i}`];
            const value = body[`param_value_${i}`];
            if (key && value)
                params[key] = value;
        }
        await index_js_1.pool.query(`UPDATE products SET name=$1, brand=$2, model=$3, category=$4, price=$5, images=$6, params=$7, updated_at=NOW() WHERE id=$8`, [name, brand || '未知品牌', model || null, category || null, price ? parseFloat(price) : null, images, JSON.stringify(params), id]);
        return c.redirect('/admin/products');
    }
    catch (error) {
        const adminUser = c.get('admin');
        const role = adminUser?.role || 'admin';
        const id = c.req.param('id');
        return c.html((0, products_js_1.productFormPage)({ id }, '更新失败: ' + error.message, role));
    }
});
// 删除产品
admin.post('/products/:id/delete', middleware_js_1.authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const adminUser = c.get('admin');
        // 尝试软删除（如果 deleted_at 字段存在）
        await index_js_1.pool.query('UPDATE products SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2', [adminUser.username, id]);
    }
    catch (error) {
        // 如果软删除失败（字段不存在），则硬删除
        const id = c.req.param('id');
        await index_js_1.pool.query('DELETE FROM products WHERE id=$1', [id]);
    }
    return c.redirect('/admin/products');
});
// ==================== 分类管理 ====================
// 分类列表
admin.get('/categories', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const result = await index_js_1.pool.query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count,
      (SELECT COUNT(*) FROM category_params WHERE category_id = c.id) as param_count
    FROM categories c
    ORDER BY c.sort_order, c.name
  `);
    return c.html((0, categories_js_1.categoriesPage)(result.rows, role));
});
// 新增分类页面
admin.get('/categories/create', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
    return c.html((0, categories_js_1.categoryFormPage)(undefined, categories.rows, undefined, role));
});
// 新增分类处理
admin.post('/categories/create', middleware_js_1.authMiddleware, async (c) => {
    try {
        const body = await c.req.parseBody();
        const { code, name, display_name, icon, parent_id, sort_order, is_active } = body;
        if (!code || !name) {
            const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
            return c.html((0, categories_js_1.categoryFormPage)(undefined, categories.rows, '编码和名称不能为空'));
        }
        await index_js_1.pool.query('INSERT INTO categories (code, name, display_name, icon, parent_id, sort_order, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)', [code, name, display_name || name, icon || null, parent_id || null, parseInt(sort_order || '0'), is_active === 'true']);
        return c.redirect('/admin/categories');
    }
    catch (error) {
        const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
        return c.html((0, categories_js_1.categoryFormPage)(undefined, categories.rows, '创建失败: ' + error.message));
    }
});
// 编辑分类页面
admin.get('/categories/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const id = c.req.param('id');
    const result = await index_js_1.pool.query('SELECT * FROM categories WHERE id = $1', [id]);
    if (result.rows.length === 0)
        return c.redirect('/admin/categories');
    const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
    return c.html((0, categories_js_1.categoryFormPage)(result.rows[0], categories.rows, undefined, role));
});
// 编辑分类处理
admin.post('/categories/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.parseBody();
        const { name, display_name, icon, parent_id, sort_order, is_active } = body;
        await index_js_1.pool.query('UPDATE categories SET name=$1, display_name=$2, icon=$3, parent_id=$4, sort_order=$5, is_active=$6 WHERE id=$7', [name, display_name || name, icon || null, parent_id || null, parseInt(sort_order || '0'), is_active === 'true', id]);
        return c.redirect('/admin/categories');
    }
    catch (error) {
        const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
        return c.html((0, categories_js_1.categoryFormPage)({ id: c.req.param('id') }, categories.rows, '更新失败: ' + error.message));
    }
});
// 删除分类
admin.post('/categories/:id/delete', middleware_js_1.authMiddleware, async (c) => {
    const id = c.req.param('id');
    await index_js_1.pool.query('DELETE FROM categories WHERE id = $1', [id]);
    return c.redirect('/admin/categories');
});
// ==================== 参数规范管理 ====================
// 参数规范列表
admin.get('/category-params', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const categoryId = c.req.query('category_id') ? parseInt(c.req.query('category_id')) : undefined;
    let query = `
    SELECT cp.*, c.name as category_name, c.display_name as category_display_name
    FROM category_params cp
    LEFT JOIN categories c ON c.id = cp.category_id
  `;
    const params = [];
    if (categoryId) {
        query += ' WHERE cp.category_id = $1';
        params.push(categoryId);
    }
    query += ' ORDER BY cp.category_id, cp.sort_order';
    const [result, categories] = await Promise.all([
        index_js_1.pool.query(query, params),
        index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order')
    ]);
    return c.html((0, category_params_js_1.categoryParamsPage)(result.rows, categories.rows, role, categoryId));
});
// 新增参数规范页面
admin.get('/category-params/create', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
    return c.html((0, category_params_js_1.categoryParamFormPage)(undefined, categories.rows, undefined, role));
});
// 新增参数规范处理
admin.post('/category-params/create', middleware_js_1.authMiddleware, async (c) => {
    try {
        const body = await c.req.parseBody();
        const { category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order } = body;
        if (!category_id || !param_key || !display_name) {
            const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
            return c.html((0, category_params_js_1.categoryParamFormPage)(undefined, categories.rows, '分类、参数名和显示名不能为空'));
        }
        let enumValuesJson = null;
        if (enum_values) {
            try {
                enumValuesJson = JSON.parse(enum_values);
            }
            catch {
                enumValuesJson = null;
            }
        }
        await index_js_1.pool.query('INSERT INTO category_params (category_id, param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [category_id, param_key, display_name, icon || null, param_type || 'text', is_core === 'true', is_filter === 'true', is_sortable === 'true', enumValuesJson ? JSON.stringify(enumValuesJson) : null, parseInt(sort_order || '0')]);
        return c.redirect('/admin/category-params');
    }
    catch (error) {
        const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
        return c.html((0, category_params_js_1.categoryParamFormPage)(undefined, categories.rows, '创建失败: ' + error.message));
    }
});
// 编辑参数规范页面
admin.get('/category-params/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const id = c.req.param('id');
    const [result, categories] = await Promise.all([
        index_js_1.pool.query('SELECT * FROM category_params WHERE id = $1', [id]),
        index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order')
    ]);
    if (result.rows.length === 0)
        return c.redirect('/admin/category-params');
    return c.html((0, category_params_js_1.categoryParamFormPage)(result.rows[0], categories.rows, undefined, role));
});
// 编辑参数规范处理
admin.post('/category-params/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.parseBody();
        const { param_key, display_name, icon, param_type, is_core, is_filter, is_sortable, enum_values, sort_order } = body;
        let enumValuesJson = null;
        if (enum_values) {
            try {
                enumValuesJson = JSON.parse(enum_values);
            }
            catch {
                enumValuesJson = null;
            }
        }
        await index_js_1.pool.query('UPDATE category_params SET param_key=$1, display_name=$2, icon=$3, param_type=$4, is_core=$5, is_filter=$6, is_sortable=$7, enum_values=$8, sort_order=$9 WHERE id=$10', [param_key, display_name, icon || null, param_type || 'text', is_core === 'true', is_filter === 'true', is_sortable === 'true', enumValuesJson ? JSON.stringify(enumValuesJson) : null, parseInt(sort_order || '0'), id]);
        return c.redirect('/admin/category-params');
    }
    catch (error) {
        const categories = await index_js_1.pool.query('SELECT * FROM categories ORDER BY sort_order');
        return c.html((0, category_params_js_1.categoryParamFormPage)({ id: c.req.param('id') }, categories.rows, '更新失败: ' + error.message));
    }
});
// 删除参数规范
admin.post('/category-params/:id/delete', middleware_js_1.authMiddleware, async (c) => {
    const id = c.req.param('id');
    await index_js_1.pool.query('DELETE FROM category_params WHERE id = $1', [id]);
    return c.redirect('/admin/category-params');
});
// ==================== 图片管理 ====================
// 图片列表
admin.get('/product-images', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const productId = c.req.query('product_id') ? parseInt(c.req.query('product_id')) : undefined;
    let query = `
    SELECT pi.*, p.name as product_name
    FROM product_images pi
    LEFT JOIN products p ON p.id = pi.product_id
  `;
    const params = [];
    if (productId) {
        query += ' WHERE pi.product_id = $1';
        params.push(productId);
    }
    query += ' ORDER BY pi.product_id, pi.image_type, pi.sort_order';
    const [result, products] = await Promise.all([
        index_js_1.pool.query(query, params),
        index_js_1.pool.query('SELECT id, name FROM products ORDER BY id DESC LIMIT 100')
    ]);
    return c.html((0, product_images_js_1.productImagesPage)(result.rows, products.rows, role, productId));
});
// 新增图片页面
admin.get('/product-images/create', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const products = await index_js_1.pool.query('SELECT id, name FROM products ORDER BY id DESC LIMIT 100');
    return c.html((0, product_images_js_1.productImageFormPage)(undefined, products.rows, undefined, role));
});
// 新增图片处理
admin.post('/product-images/create', middleware_js_1.authMiddleware, async (c) => {
    try {
        const body = await c.req.parseBody();
        const { product_id, image_url, image_type, sort_order } = body;
        if (!product_id) {
            const products = await index_js_1.pool.query('SELECT id, name FROM products ORDER BY id DESC LIMIT 100');
            return c.html((0, product_images_js_1.productImageFormPage)(undefined, products.rows, '产品不能为空'));
        }
        await index_js_1.pool.query('INSERT INTO product_images (product_id, image_url, image_type, sort_order) VALUES ($1, $2, $3, $4)', [product_id, image_url || null, image_type || 'main', parseInt(sort_order || '0')]);
        return c.redirect('/admin/product-images');
    }
    catch (error) {
        const products = await index_js_1.pool.query('SELECT id, name FROM products ORDER BY id DESC LIMIT 100');
        return c.html((0, product_images_js_1.productImageFormPage)(undefined, products.rows, '创建失败: ' + error.message));
    }
});
// 编辑图片页面
admin.get('/product-images/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const id = c.req.param('id');
    const [result, products] = await Promise.all([
        index_js_1.pool.query('SELECT * FROM product_images WHERE id = $1', [id]),
        index_js_1.pool.query('SELECT id, name FROM products ORDER BY id DESC LIMIT 100')
    ]);
    if (result.rows.length === 0)
        return c.redirect('/admin/product-images');
    return c.html((0, product_images_js_1.productImageFormPage)(result.rows[0], products.rows, undefined, role));
});
// 编辑图片处理
admin.post('/product-images/:id/edit', middleware_js_1.authMiddleware, async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.parseBody();
        const { image_url, image_type, sort_order } = body;
        await index_js_1.pool.query('UPDATE product_images SET image_url=$1, image_type=$2, sort_order=$3 WHERE id=$4', [image_url || null, image_type || 'main', parseInt(sort_order || '0'), id]);
        return c.redirect('/admin/product-images');
    }
    catch (error) {
        const products = await index_js_1.pool.query('SELECT id, name FROM products ORDER BY id DESC LIMIT 100');
        return c.html((0, product_images_js_1.productImageFormPage)({ id: c.req.param('id') }, products.rows, '更新失败: ' + error.message));
    }
});
// 删除图片
admin.post('/product-images/:id/delete', middleware_js_1.authMiddleware, async (c) => {
    const id = c.req.param('id');
    await index_js_1.pool.query('DELETE FROM product_images WHERE id = $1', [id]);
    return c.redirect('/admin/product-images');
});
// ==================== 操作日志 ====================
admin.get('/logs', middleware_js_1.authMiddleware, async (c) => {
    const adminUser = c.get('admin');
    const role = adminUser?.role || 'admin';
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = 50;
    const offset = (page - 1) * pageSize;
    const [logs, count] = await Promise.all([
        index_js_1.pool.query('SELECT * FROM operation_logs ORDER BY id DESC LIMIT $1 OFFSET $2', [pageSize, offset]),
        index_js_1.pool.query('SELECT COUNT(*) FROM operation_logs'),
    ]);
    return c.html((0, logs_js_1.logsPage)(logs.rows, page, parseInt(count.rows[0].count), pageSize, role));
});
// 删除单条日志（仅超级管理员）
admin.post('/logs/:id/delete', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    const id = c.req.param('id');
    await index_js_1.pool.query('DELETE FROM operation_logs WHERE id = $1', [id]);
    return c.redirect('/admin/logs');
});
// 清空所有日志（仅超级管理员）
admin.post('/logs/clear', middleware_js_1.authMiddleware, middleware_js_1.superAdminMiddleware, async (c) => {
    await index_js_1.pool.query('DELETE FROM operation_logs');
    return c.redirect('/admin/logs');
});
exports.default = admin;
