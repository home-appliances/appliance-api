"use strict";
/**
 * Drizzle ORM 查询函数
 * 提供类型安全的数据库操作
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCategories = getCategories;
exports.getCategoryById = getCategoryById;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
exports.getProducts = getProducts;
exports.getProductById = getProductById;
exports.createProduct = createProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.batchDeleteProducts = batchDeleteProducts;
exports.getProductImages = getProductImages;
exports.getProductImageById = getProductImageById;
exports.createProductImage = createProductImage;
exports.updateProductImage = updateProductImage;
exports.deleteProductImage = deleteProductImage;
exports.batchDeleteProductImages = batchDeleteProductImages;
exports.updateProductImageSort = updateProductImageSort;
exports.getCategoryParams = getCategoryParams;
exports.getCategoryParamById = getCategoryParamById;
exports.createCategoryParam = createCategoryParam;
exports.updateCategoryParam = updateCategoryParam;
exports.deleteCategoryParam = deleteCategoryParam;
exports.updateCategoryParamSort = updateCategoryParamSort;
exports.getAdmins = getAdmins;
exports.getAdminById = getAdminById;
exports.getAdminByUsername = getAdminByUsername;
exports.createAdmin = createAdmin;
exports.updateAdmin = updateAdmin;
exports.updateAdminLastLogin = updateAdminLastLogin;
exports.logSearch = logSearch;
exports.getSearchLogs = getSearchLogs;
exports.createOperationLog = createOperationLog;
exports.getOperationLogs = getOperationLogs;
exports.deleteOperationLog = deleteOperationLog;
exports.clearOperationLogs = clearOperationLogs;
exports.getSetting = getSetting;
exports.updateSetting = updateSetting;
exports.getDashboardStats = getDashboardStats;
exports.getBrands = getBrands;
const drizzle_orm_1 = require("drizzle-orm");
const drizzle_js_1 = require("./drizzle.js");
const schema_js_1 = require("./schema.js");
// =====================================================
// 分类查询
// =====================================================
async function getCategories() {
    return drizzle_js_1.db
        .select({
        id: schema_js_1.categories.id,
        code: schema_js_1.categories.code,
        name: schema_js_1.categories.name,
        displayName: schema_js_1.categories.displayName,
        icon: schema_js_1.categories.icon,
        parentId: schema_js_1.categories.parentId,
        sortOrder: schema_js_1.categories.sortOrder,
        isActive: schema_js_1.categories.isActive,
        createdAt: schema_js_1.categories.createdAt,
    })
        .from(schema_js_1.categories)
        .where((0, drizzle_orm_1.eq)(schema_js_1.categories.isActive, true))
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.categories.sortOrder), (0, drizzle_orm_1.asc)(schema_js_1.categories.name));
}
async function getCategoryById(id) {
    const result = await drizzle_js_1.db
        .select()
        .from(schema_js_1.categories)
        .where((0, drizzle_orm_1.eq)(schema_js_1.categories.id, id))
        .limit(1);
    return result[0] || null;
}
async function createCategory(data) {
    const result = await drizzle_js_1.db.insert(schema_js_1.categories).values(data).returning();
    return result[0];
}
async function updateCategory(id, data) {
    const result = await drizzle_js_1.db
        .update(schema_js_1.categories)
        .set(data)
        .where((0, drizzle_orm_1.eq)(schema_js_1.categories.id, id))
        .returning();
    return result[0] || null;
}
async function deleteCategory(id) {
    const result = await drizzle_js_1.db
        .delete(schema_js_1.categories)
        .where((0, drizzle_orm_1.eq)(schema_js_1.categories.id, id))
        .returning();
    return result[0] || null;
}
// =====================================================
// 产品查询
// =====================================================
async function getProducts(options = {}) {
    const { page = 1, limit = 20, keyword, brand, categoryId } = options;
    const offset = (page - 1) * limit;
    // 构建查询条件
    const conditions = [];
    if (keyword) {
        conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_js_1.products.name, `%${keyword}%`), (0, drizzle_orm_1.ilike)(schema_js_1.products.brand, `%${keyword}%`), (0, drizzle_orm_1.ilike)(schema_js_1.products.model, `%${keyword}%`)));
    }
    if (brand) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.products.brand, brand));
    }
    if (categoryId) {
        conditions.push((0, drizzle_orm_1.eq)(schema_js_1.products.categoryId, categoryId));
    }
    // 只查询未删除的产品
    conditions.push((0, drizzle_orm_1.isNull)(schema_js_1.products.deletedAt));
    const whereClause = conditions.length > 0 ? (0, drizzle_orm_1.and)(...conditions) : undefined;
    // 查询总数
    const [{ total }] = await drizzle_js_1.db
        .select({ total: (0, drizzle_orm_1.count)() })
        .from(schema_js_1.products)
        .where(whereClause);
    // 查询数据（关联 categories 取分类名 + 子查询取主图）
    const data = await drizzle_js_1.db
        .select({
        id: schema_js_1.products.id,
        name: schema_js_1.products.name,
        brand: schema_js_1.products.brand,
        model: schema_js_1.products.model,
        categoryId: schema_js_1.products.categoryId,
        categoryName: schema_js_1.categories.name,
        categoryCode: schema_js_1.categories.code,
        price: schema_js_1.products.price,
        originalPrice: schema_js_1.products.originalPrice,
        rating: schema_js_1.products.rating,
        reviewCount: schema_js_1.products.reviewCount,
        params: schema_js_1.products.params,
        createdAt: schema_js_1.products.createdAt,
        updatedAt: schema_js_1.products.updatedAt,
        imageUrl: (0, drizzle_orm_1.sql) `(
        SELECT ${schema_js_1.productImages.imageUrl}
        FROM ${schema_js_1.productImages}
        WHERE ${schema_js_1.productImages.productId} = ${schema_js_1.products.id}
        ORDER BY
          CASE ${schema_js_1.productImages.imageType} WHEN 'main' THEN 0 ELSE 1 END,
          ${schema_js_1.productImages.sortOrder}
        LIMIT 1
      )`.as('image_url'),
    })
        .from(schema_js_1.products)
        .leftJoin(schema_js_1.categories, (0, drizzle_orm_1.eq)(schema_js_1.products.categoryId, schema_js_1.categories.id))
        .where(whereClause)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.products.createdAt))
        .limit(limit)
        .offset(offset);
    return {
        products: data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}
async function getProductById(id) {
    const result = await drizzle_js_1.db
        .select({
        id: schema_js_1.products.id,
        name: schema_js_1.products.name,
        brand: schema_js_1.products.brand,
        model: schema_js_1.products.model,
        categoryId: schema_js_1.products.categoryId,
        categoryName: schema_js_1.categories.name,
        categoryCode: schema_js_1.categories.code,
        price: schema_js_1.products.price,
        originalPrice: schema_js_1.products.originalPrice,
        rating: schema_js_1.products.rating,
        reviewCount: schema_js_1.products.reviewCount,
        params: schema_js_1.products.params,
        sourceUrl: schema_js_1.products.sourceUrl,
        sourcePlatform: schema_js_1.products.sourcePlatform,
        createdAt: schema_js_1.products.createdAt,
        updatedAt: schema_js_1.products.updatedAt,
    })
        .from(schema_js_1.products)
        .leftJoin(schema_js_1.categories, (0, drizzle_orm_1.eq)(schema_js_1.products.categoryId, schema_js_1.categories.id))
        .where((0, drizzle_orm_1.eq)(schema_js_1.products.id, id))
        .limit(1);
    return result[0] || null;
}
async function createProduct(data) {
    const result = await drizzle_js_1.db.insert(schema_js_1.products).values(data).returning();
    return result[0];
}
async function updateProduct(id, data) {
    const result = await drizzle_js_1.db
        .update(schema_js_1.products)
        .set({ ...data, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.products.id, id))
        .returning();
    return result[0] || null;
}
async function deleteProduct(id, deletedBy) {
    // 软删除
    const result = await drizzle_js_1.db
        .update(schema_js_1.products)
        .set({ deletedAt: new Date(), deletedBy: deletedBy || null })
        .where((0, drizzle_orm_1.eq)(schema_js_1.products.id, id))
        .returning();
    return result[0] || null;
}
async function batchDeleteProducts(ids, deletedBy) {
    // 批量软删除
    await drizzle_js_1.db
        .update(schema_js_1.products)
        .set({ deletedAt: new Date(), deletedBy: deletedBy || null })
        .where((0, drizzle_orm_1.inArray)(schema_js_1.products.id, ids));
    return ids.length;
}
// =====================================================
// 产品图片查询
// =====================================================
async function getProductImages(productId) {
    return drizzle_js_1.db
        .select()
        .from(schema_js_1.productImages)
        .where((0, drizzle_orm_1.eq)(schema_js_1.productImages.productId, productId))
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.productImages.imageType), (0, drizzle_orm_1.asc)(schema_js_1.productImages.sortOrder));
}
async function getProductImageById(id) {
    const result = await drizzle_js_1.db
        .select()
        .from(schema_js_1.productImages)
        .where((0, drizzle_orm_1.eq)(schema_js_1.productImages.id, id))
        .limit(1);
    return result[0] || null;
}
async function createProductImage(data) {
    const result = await drizzle_js_1.db.insert(schema_js_1.productImages).values(data).returning();
    return result[0];
}
async function updateProductImage(id, data) {
    const result = await drizzle_js_1.db
        .update(schema_js_1.productImages)
        .set(data)
        .where((0, drizzle_orm_1.eq)(schema_js_1.productImages.id, id))
        .returning();
    return result[0] || null;
}
async function deleteProductImage(id) {
    const result = await drizzle_js_1.db
        .delete(schema_js_1.productImages)
        .where((0, drizzle_orm_1.eq)(schema_js_1.productImages.id, id))
        .returning();
    return result[0] || null;
}
async function batchDeleteProductImages(ids) {
    const result = await drizzle_js_1.db
        .delete(schema_js_1.productImages)
        .where((0, drizzle_orm_1.inArray)(schema_js_1.productImages.id, ids))
        .returning();
    return result;
}
async function updateProductImageSort(items) {
    for (const item of items) {
        await drizzle_js_1.db
            .update(schema_js_1.productImages)
            .set({ sortOrder: item.sortOrder })
            .where((0, drizzle_orm_1.eq)(schema_js_1.productImages.id, item.id));
    }
}
// =====================================================
// 品类参数规范查询
// =====================================================
async function getCategoryParams(categoryId) {
    const query = drizzle_js_1.db
        .select({
        id: schema_js_1.categoryParams.id,
        categoryId: schema_js_1.categoryParams.categoryId,
        categoryName: schema_js_1.categories.name,
        categoryDisplayName: schema_js_1.categories.displayName,
        paramKey: schema_js_1.categoryParams.paramKey,
        displayName: schema_js_1.categoryParams.displayName,
        icon: schema_js_1.categoryParams.icon,
        paramType: schema_js_1.categoryParams.paramType,
        isCore: schema_js_1.categoryParams.isCore,
        isFilter: schema_js_1.categoryParams.isFilter,
        isSortable: schema_js_1.categoryParams.isSortable,
        enumValues: schema_js_1.categoryParams.enumValues,
        sortOrder: schema_js_1.categoryParams.sortOrder,
        createdAt: schema_js_1.categoryParams.createdAt,
    })
        .from(schema_js_1.categoryParams)
        .leftJoin(schema_js_1.categories, (0, drizzle_orm_1.eq)(schema_js_1.categoryParams.categoryId, schema_js_1.categories.id));
    if (categoryId) {
        return query.where((0, drizzle_orm_1.eq)(schema_js_1.categoryParams.categoryId, categoryId)).orderBy((0, drizzle_orm_1.asc)(schema_js_1.categoryParams.sortOrder));
    }
    return query.orderBy((0, drizzle_orm_1.asc)(schema_js_1.categoryParams.categoryId), (0, drizzle_orm_1.asc)(schema_js_1.categoryParams.sortOrder));
}
async function getCategoryParamById(id) {
    const result = await drizzle_js_1.db
        .select()
        .from(schema_js_1.categoryParams)
        .where((0, drizzle_orm_1.eq)(schema_js_1.categoryParams.id, id))
        .limit(1);
    return result[0] || null;
}
async function createCategoryParam(data) {
    const result = await drizzle_js_1.db.insert(schema_js_1.categoryParams).values(data).returning();
    return result[0];
}
async function updateCategoryParam(id, data) {
    const result = await drizzle_js_1.db
        .update(schema_js_1.categoryParams)
        .set(data)
        .where((0, drizzle_orm_1.eq)(schema_js_1.categoryParams.id, id))
        .returning();
    return result[0] || null;
}
async function deleteCategoryParam(id) {
    const result = await drizzle_js_1.db
        .delete(schema_js_1.categoryParams)
        .where((0, drizzle_orm_1.eq)(schema_js_1.categoryParams.id, id))
        .returning();
    return result[0] || null;
}
async function updateCategoryParamSort(items) {
    for (const item of items) {
        await drizzle_js_1.db
            .update(schema_js_1.categoryParams)
            .set({ sortOrder: item.sortOrder })
            .where((0, drizzle_orm_1.eq)(schema_js_1.categoryParams.id, item.id));
    }
}
// =====================================================
// 管理员查询
// =====================================================
async function getAdmins() {
    return drizzle_js_1.db
        .select({
        id: schema_js_1.admins.id,
        username: schema_js_1.admins.username,
        name: schema_js_1.admins.name,
        email: schema_js_1.admins.email,
        phone: schema_js_1.admins.phone,
        role: schema_js_1.admins.role,
        status: schema_js_1.admins.status,
        createdAt: schema_js_1.admins.createdAt,
        lastLogin: schema_js_1.admins.lastLogin,
    })
        .from(schema_js_1.admins)
        .where((0, drizzle_orm_1.sql) `${schema_js_1.admins.status} != 'deleted'`)
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.admins.id));
}
async function getAdminById(id) {
    const result = await drizzle_js_1.db
        .select()
        .from(schema_js_1.admins)
        .where((0, drizzle_orm_1.eq)(schema_js_1.admins.id, id))
        .limit(1);
    return result[0] || null;
}
async function getAdminByUsername(username) {
    const result = await drizzle_js_1.db
        .select()
        .from(schema_js_1.admins)
        .where((0, drizzle_orm_1.eq)(schema_js_1.admins.username, username))
        .limit(1);
    return result[0] || null;
}
async function createAdmin(data) {
    const result = await drizzle_js_1.db.insert(schema_js_1.admins).values(data).returning();
    return result[0];
}
async function updateAdmin(id, data) {
    const result = await drizzle_js_1.db
        .update(schema_js_1.admins)
        .set({ ...data, updatedAt: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.admins.id, id))
        .returning();
    return result[0] || null;
}
async function updateAdminLastLogin(id) {
    await drizzle_js_1.db
        .update(schema_js_1.admins)
        .set({ lastLogin: new Date() })
        .where((0, drizzle_orm_1.eq)(schema_js_1.admins.id, id));
}
// =====================================================
// 搜索日志查询
// =====================================================
async function logSearch(keyword) {
    if (!keyword || !keyword.trim())
        return;
    const trimmed = keyword.trim();
    // 尝试更新现有记录
    const existing = await drizzle_js_1.db
        .select()
        .from(schema_js_1.searchLogs)
        .where((0, drizzle_orm_1.eq)(schema_js_1.searchLogs.keyword, trimmed))
        .limit(1);
    if (existing.length > 0) {
        await drizzle_js_1.db
            .update(schema_js_1.searchLogs)
            .set({
            searchCount: (0, drizzle_orm_1.sql) `${schema_js_1.searchLogs.searchCount} + 1`,
            lastSearchedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(schema_js_1.searchLogs.keyword, trimmed));
    }
    else {
        await drizzle_js_1.db.insert(schema_js_1.searchLogs).values({ keyword: trimmed });
    }
}
async function getSearchLogs(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [{ total }] = await drizzle_js_1.db
        .select({ total: (0, drizzle_orm_1.count)() })
        .from(schema_js_1.searchLogs);
    const data = await drizzle_js_1.db
        .select()
        .from(schema_js_1.searchLogs)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.searchLogs.searchCount))
        .limit(limit)
        .offset(offset);
    return { logs: data, total, page, limit };
}
// =====================================================
// 操作日志查询
// =====================================================
async function createOperationLog(data) {
    const result = await drizzle_js_1.db.insert(schema_js_1.operationLogs).values(data).returning();
    return result[0];
}
async function getOperationLogs(page = 1, limit = 50) {
    const offset = (page - 1) * limit;
    const [{ total }] = await drizzle_js_1.db
        .select({ total: (0, drizzle_orm_1.count)() })
        .from(schema_js_1.operationLogs);
    const data = await drizzle_js_1.db
        .select()
        .from(schema_js_1.operationLogs)
        .orderBy((0, drizzle_orm_1.desc)(schema_js_1.operationLogs.id))
        .limit(limit)
        .offset(offset);
    return { logs: data, total, page, limit };
}
async function deleteOperationLog(id) {
    const result = await drizzle_js_1.db
        .delete(schema_js_1.operationLogs)
        .where((0, drizzle_orm_1.eq)(schema_js_1.operationLogs.id, id))
        .returning();
    return result[0] || null;
}
async function clearOperationLogs() {
    await drizzle_js_1.db.delete(schema_js_1.operationLogs);
}
// =====================================================
// 系统设置查询
// =====================================================
async function getSetting(key) {
    const result = await drizzle_js_1.db
        .select()
        .from(schema_js_1.systemSettings)
        .where((0, drizzle_orm_1.eq)(schema_js_1.systemSettings.key, key))
        .limit(1);
    return result[0]?.value || null;
}
async function updateSetting(key, value) {
    const result = await drizzle_js_1.db
        .insert(schema_js_1.systemSettings)
        .values({ key, value })
        .onConflictDoUpdate({
        target: schema_js_1.systemSettings.key,
        set: { value, updatedAt: new Date() },
    })
        .returning();
    return result[0];
}
// =====================================================
// 统计查询
// =====================================================
async function getDashboardStats() {
    const [productCount] = await drizzle_js_1.db
        .select({ count: (0, drizzle_orm_1.count)() })
        .from(schema_js_1.products)
        .where((0, drizzle_orm_1.isNull)(schema_js_1.products.deletedAt));
    const [brandCount] = await drizzle_js_1.db
        .select({ count: (0, drizzle_orm_1.sql) `COUNT(DISTINCT ${schema_js_1.products.brand})` })
        .from(schema_js_1.products)
        .where((0, drizzle_orm_1.isNull)(schema_js_1.products.deletedAt));
    const [categoryCount] = await drizzle_js_1.db
        .select({ count: (0, drizzle_orm_1.count)() })
        .from(schema_js_1.categories);
    const [searchCount] = await drizzle_js_1.db
        .select({ count: (0, drizzle_orm_1.count)() })
        .from(schema_js_1.searchLogs);
    return {
        totalProducts: productCount.count,
        totalBrands: brandCount.count,
        totalCategories: categoryCount.count,
        totalSearches: searchCount.count,
    };
}
// =====================================================
// 品牌列表（用于下拉筛选）
// =====================================================
async function getBrands() {
    const result = await drizzle_js_1.db
        .selectDistinct({ brand: schema_js_1.products.brand })
        .from(schema_js_1.products)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.isNotNull)(schema_js_1.products.brand), (0, drizzle_orm_1.isNull)(schema_js_1.products.deletedAt)))
        .orderBy((0, drizzle_orm_1.asc)(schema_js_1.products.brand));
    return result.map(r => r.brand);
}
