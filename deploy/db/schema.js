"use strict";
/**
 * Drizzle ORM Schema 定义
 * 全品类家电产品数据库
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.crawlerTasks = exports.systemSettings = exports.operationLogs = exports.searchLogs = exports.admins = exports.categoryParams = exports.productImages = exports.products = exports.categories = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// =====================================================
// 分类表
// =====================================================
exports.categories = (0, pg_core_1.pgTable)('categories', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    code: (0, pg_core_1.text)('code').unique().notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    displayName: (0, pg_core_1.text)('display_name'),
    icon: (0, pg_core_1.text)('icon'),
    parentId: (0, pg_core_1.bigint)('parent_id', { mode: 'number' }),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// =====================================================
// 产品表
// =====================================================
exports.products = (0, pg_core_1.pgTable)('products', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    name: (0, pg_core_1.text)('name').notNull(),
    brand: (0, pg_core_1.text)('brand').notNull(),
    model: (0, pg_core_1.text)('model'),
    categoryId: (0, pg_core_1.bigint)('category_id', { mode: 'number' }),
    price: (0, pg_core_1.numeric)('price', { precision: 10, scale: 2 }),
    originalPrice: (0, pg_core_1.numeric)('original_price', { precision: 10, scale: 2 }),
    rating: (0, pg_core_1.numeric)('rating', { precision: 3, scale: 1 }),
    reviewCount: (0, pg_core_1.integer)('review_count').default(0),
    params: (0, pg_core_1.jsonb)('params').default({}).notNull(),
    searchVector: (0, pg_core_1.text)('search_vector'),
    pinyin: (0, pg_core_1.text)('pinyin'),
    pinyinInitials: (0, pg_core_1.text)('pinyin_initials'),
    sourceUrl: (0, pg_core_1.text)('source_url').unique(),
    sourcePlatform: (0, pg_core_1.text)('source_platform').default('pconline'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
    deletedAt: (0, pg_core_1.timestamp)('deleted_at'),
    deletedBy: (0, pg_core_1.text)('deleted_by'),
});
// =====================================================
// 产品图片表
// =====================================================
exports.productImages = (0, pg_core_1.pgTable)('product_images', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    productId: (0, pg_core_1.bigint)('product_id', { mode: 'number' }).notNull(),
    imageUrl: (0, pg_core_1.text)('image_url'),
    imageType: (0, pg_core_1.text)('image_type').default('main').notNull(),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    // 唯一约束：同一产品、同一类型、同一排序不重复
    productTypeSortUnique: (0, pg_core_1.unique)('product_images_product_type_sort_unique').on(table.productId, table.imageType, table.sortOrder),
}));
// =====================================================
// 品类参数规范表
// =====================================================
exports.categoryParams = (0, pg_core_1.pgTable)('category_params', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    categoryId: (0, pg_core_1.bigint)('category_id', { mode: 'number' }).notNull(),
    paramKey: (0, pg_core_1.text)('param_key').notNull(),
    displayName: (0, pg_core_1.text)('display_name').notNull(),
    icon: (0, pg_core_1.text)('icon'),
    paramType: (0, pg_core_1.text)('param_type').default('text').notNull(),
    isCore: (0, pg_core_1.boolean)('is_core').default(false),
    isFilter: (0, pg_core_1.boolean)('is_filter').default(false),
    isSortable: (0, pg_core_1.boolean)('is_sortable').default(false),
    enumValues: (0, pg_core_1.jsonb)('enum_values'),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
}, (table) => ({
    // 唯一约束：同一分类下参数名不重复
    categoryParamUnique: (0, pg_core_1.unique)('category_params_category_param_unique').on(table.categoryId, table.paramKey),
}));
// =====================================================
// 管理员表
// =====================================================
exports.admins = (0, pg_core_1.pgTable)('admins', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    username: (0, pg_core_1.text)('username').unique().notNull(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    name: (0, pg_core_1.text)('name'),
    email: (0, pg_core_1.text)('email'),
    phone: (0, pg_core_1.text)('phone'),
    role: (0, pg_core_1.text)('role').default('admin'),
    status: (0, pg_core_1.text)('status').default('active'),
    avatar: (0, pg_core_1.text)('avatar'),
    remark: (0, pg_core_1.text)('remark'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    lastLogin: (0, pg_core_1.timestamp)('last_login'),
});
// =====================================================
// 搜索日志表
// =====================================================
exports.searchLogs = (0, pg_core_1.pgTable)('search_logs', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    keyword: (0, pg_core_1.text)('keyword').unique().notNull(),
    searchCount: (0, pg_core_1.integer)('search_count').default(1).notNull(),
    lastSearchedAt: (0, pg_core_1.timestamp)('last_searched_at').defaultNow().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
// =====================================================
// 操作日志表
// =====================================================
exports.operationLogs = (0, pg_core_1.pgTable)('operation_logs', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    adminId: (0, pg_core_1.bigint)('admin_id', { mode: 'number' }),
    operator: (0, pg_core_1.text)('operator').notNull(),
    ip: (0, pg_core_1.text)('ip'),
    type: (0, pg_core_1.text)('type').notNull(),
    target: (0, pg_core_1.text)('target'),
    result: (0, pg_core_1.text)('result').default('success'),
    detail: (0, pg_core_1.text)('detail'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
// =====================================================
// 系统设置表
// =====================================================
exports.systemSettings = (0, pg_core_1.pgTable)('system_settings', {
    key: (0, pg_core_1.text)('key').primaryKey(),
    value: (0, pg_core_1.jsonb)('value').notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
// =====================================================
// 爬虫任务表
// =====================================================
exports.crawlerTasks = (0, pg_core_1.pgTable)('crawler_tasks', {
    id: (0, pg_core_1.bigint)('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    category: (0, pg_core_1.text)('category'),
    status: (0, pg_core_1.text)('status').default('pending'),
    progress: (0, pg_core_1.integer)('progress').default(0),
    totalProducts: (0, pg_core_1.integer)('total_products').default(0),
    successCount: (0, pg_core_1.integer)('success_count').default(0),
    failCount: (0, pg_core_1.integer)('fail_count').default(0),
    errorMessage: (0, pg_core_1.text)('error_message'),
    startedAt: (0, pg_core_1.timestamp)('started_at'),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
