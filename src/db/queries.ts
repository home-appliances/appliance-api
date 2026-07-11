/**
 * Drizzle ORM 查询函数
 * 提供类型安全的数据库操作
 */

import { eq, desc, asc, like, ilike, sql, and, or, count, isNull, isNotNull, inArray } from 'drizzle-orm';
import { db } from './drizzle.js';
import {
  categories,
  products,
  productImages,
  categoryParams,
  admins,
  searchLogs,
  operationLogs,
  systemSettings,
  crawlerTasks,
} from './schema.js';

// =====================================================
// 分类查询
// =====================================================

export async function getCategories() {
  return db
    .select({
      id: categories.id,
      code: categories.code,
      name: categories.name,
      displayName: categories.displayName,
      icon: categories.icon,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
      isActive: categories.isActive,
      createdAt: categories.createdAt,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getCategoryById(id: number) {
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createCategory(data: typeof categories.$inferInsert) {
  const result = await db.insert(categories).values(data).returning();
  return result[0];
}

export async function updateCategory(id: number, data: Partial<typeof categories.$inferInsert>) {
  const result = await db
    .update(categories)
    .set(data)
    .where(eq(categories.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteCategory(id: number) {
  const result = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning();
  return result[0] || null;
}

// =====================================================
// 产品查询
// =====================================================

export async function getProducts(options: {
  page?: number;
  limit?: number;
  keyword?: string;
  brand?: string;
  categoryId?: number;
} = {}) {
  const { page = 1, limit = 20, keyword, brand, categoryId } = options;
  const offset = (page - 1) * limit;

  // 构建查询条件
  const conditions = [];

  if (keyword) {
    conditions.push(
      or(
        ilike(products.name, `%${keyword}%`),
        ilike(products.brand, `%${keyword}%`),
        ilike(products.model, `%${keyword}%`)
      )
    );
  }

  if (brand) {
    conditions.push(eq(products.brand, brand));
  }

  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  // 只查询未删除的产品
  conditions.push(isNull(products.deletedAt));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询总数
  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(whereClause);

  // 查询数据
  const data = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      model: products.model,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categoryCode: categories.code,
      price: products.price,
      originalPrice: products.originalPrice,
      rating: products.rating,
      reviewCount: products.reviewCount,
      params: products.params,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(whereClause)
    .orderBy(desc(products.createdAt))
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

export async function getProductById(id: number) {
  const result = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      model: products.model,
      categoryId: products.categoryId,
      categoryName: categories.name,
      categoryCode: categories.code,
      price: products.price,
      originalPrice: products.originalPrice,
      rating: products.rating,
      reviewCount: products.reviewCount,
      params: products.params,
      sourceUrl: products.sourceUrl,
      sourcePlatform: products.sourcePlatform,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);

  return result[0] || null;
}

export async function createProduct(data: typeof products.$inferInsert) {
  const result = await db.insert(products).values(data).returning();
  return result[0];
}

export async function updateProduct(id: number, data: Partial<typeof products.$inferInsert>) {
  const result = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteProduct(id: number, deletedBy?: string) {
  // 软删除
  const result = await db
    .update(products)
    .set({ deletedAt: new Date(), deletedBy: deletedBy || null })
    .where(eq(products.id, id))
    .returning();
  return result[0] || null;
}

export async function batchDeleteProducts(ids: number[], deletedBy?: string): Promise<number> {
  // 批量软删除
  await db
    .update(products)
    .set({ deletedAt: new Date(), deletedBy: deletedBy || null })
    .where(inArray(products.id, ids));
  return ids.length;
}

// =====================================================
// 产品图片查询
// =====================================================

export async function getProductImages(productId: number) {
  return db
    .select()
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.imageType), asc(productImages.sortOrder));
}

export async function getProductImageById(id: number) {
  const result = await db
    .select()
    .from(productImages)
    .where(eq(productImages.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createProductImage(data: typeof productImages.$inferInsert) {
  const result = await db.insert(productImages).values(data).returning();
  return result[0];
}

export async function updateProductImage(id: number, data: Partial<typeof productImages.$inferInsert>) {
  const result = await db
    .update(productImages)
    .set(data)
    .where(eq(productImages.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteProductImage(id: number) {
  const result = await db
    .delete(productImages)
    .where(eq(productImages.id, id))
    .returning();
  return result[0] || null;
}

export async function batchDeleteProductImages(ids: number[]) {
  const result = await db
    .delete(productImages)
    .where(inArray(productImages.id, ids))
    .returning();
  return result;
}

export async function updateProductImageSort(items: Array<{ id: number; sortOrder: number }>) {
  for (const item of items) {
    await db
      .update(productImages)
      .set({ sortOrder: item.sortOrder })
      .where(eq(productImages.id, item.id));
  }
}

// =====================================================
// 品类参数规范查询
// =====================================================

export async function getCategoryParams(categoryId?: number) {
  const query = db
    .select({
      id: categoryParams.id,
      categoryId: categoryParams.categoryId,
      categoryName: categories.name,
      categoryDisplayName: categories.displayName,
      paramKey: categoryParams.paramKey,
      displayName: categoryParams.displayName,
      icon: categoryParams.icon,
      paramType: categoryParams.paramType,
      isCore: categoryParams.isCore,
      isFilter: categoryParams.isFilter,
      isSortable: categoryParams.isSortable,
      enumValues: categoryParams.enumValues,
      sortOrder: categoryParams.sortOrder,
      createdAt: categoryParams.createdAt,
    })
    .from(categoryParams)
    .leftJoin(categories, eq(categoryParams.categoryId, categories.id));

  if (categoryId) {
    return query.where(eq(categoryParams.categoryId, categoryId)).orderBy(asc(categoryParams.sortOrder));
  }

  return query.orderBy(asc(categoryParams.categoryId), asc(categoryParams.sortOrder));
}

export async function getCategoryParamById(id: number) {
  const result = await db
    .select()
    .from(categoryParams)
    .where(eq(categoryParams.id, id))
    .limit(1);
  return result[0] || null;
}

export async function createCategoryParam(data: typeof categoryParams.$inferInsert) {
  const result = await db.insert(categoryParams).values(data).returning();
  return result[0];
}

export async function updateCategoryParam(id: number, data: Partial<typeof categoryParams.$inferInsert>) {
  const result = await db
    .update(categoryParams)
    .set(data)
    .where(eq(categoryParams.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteCategoryParam(id: number) {
  const result = await db
    .delete(categoryParams)
    .where(eq(categoryParams.id, id))
    .returning();
  return result[0] || null;
}

export async function updateCategoryParamSort(items: Array<{ id: number; sortOrder: number }>) {
  for (const item of items) {
    await db
      .update(categoryParams)
      .set({ sortOrder: item.sortOrder })
      .where(eq(categoryParams.id, item.id));
  }
}

// =====================================================
// 管理员查询
// =====================================================

export async function getAdmins() {
  return db
    .select({
      id: admins.id,
      username: admins.username,
      name: admins.name,
      email: admins.email,
      phone: admins.phone,
      role: admins.role,
      status: admins.status,
      createdAt: admins.createdAt,
      lastLogin: admins.lastLogin,
    })
    .from(admins)
    .where(sql`${admins.status} != 'deleted'`)
    .orderBy(asc(admins.id));
}

export async function getAdminById(id: number) {
  const result = await db
    .select()
    .from(admins)
    .where(eq(admins.id, id))
    .limit(1);
  return result[0] || null;
}

export async function getAdminByUsername(username: string) {
  const result = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);
  return result[0] || null;
}

export async function createAdmin(data: typeof admins.$inferInsert) {
  const result = await db.insert(admins).values(data).returning();
  return result[0];
}

export async function updateAdmin(id: number, data: Partial<typeof admins.$inferInsert>) {
  const result = await db
    .update(admins)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(admins.id, id))
    .returning();
  return result[0] || null;
}

export async function updateAdminLastLogin(id: number) {
  await db
    .update(admins)
    .set({ lastLogin: new Date() })
    .where(eq(admins.id, id));
}

// =====================================================
// 搜索日志查询
// =====================================================

export async function logSearch(keyword: string) {
  if (!keyword || !keyword.trim()) return;
  const trimmed = keyword.trim();

  // 尝试更新现有记录
  const existing = await db
    .select()
    .from(searchLogs)
    .where(eq(searchLogs.keyword, trimmed))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(searchLogs)
      .set({
        searchCount: sql`${searchLogs.searchCount} + 1`,
        lastSearchedAt: new Date(),
      })
      .where(eq(searchLogs.keyword, trimmed));
  } else {
    await db.insert(searchLogs).values({ keyword: trimmed });
  }
}

export async function getSearchLogs(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: count() })
    .from(searchLogs);

  const data = await db
    .select()
    .from(searchLogs)
    .orderBy(desc(searchLogs.searchCount))
    .limit(limit)
    .offset(offset);

  return { logs: data, total, page, limit };
}

// =====================================================
// 操作日志查询
// =====================================================

export async function createOperationLog(data: typeof operationLogs.$inferInsert) {
  const result = await db.insert(operationLogs).values(data).returning();
  return result[0];
}

export async function getOperationLogs(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: count() })
    .from(operationLogs);

  const data = await db
    .select()
    .from(operationLogs)
    .orderBy(desc(operationLogs.id))
    .limit(limit)
    .offset(offset);

  return { logs: data, total, page, limit };
}

export async function deleteOperationLog(id: number) {
  const result = await db
    .delete(operationLogs)
    .where(eq(operationLogs.id, id))
    .returning();
  return result[0] || null;
}

export async function clearOperationLogs() {
  await db.delete(operationLogs);
}

// =====================================================
// 系统设置查询
// =====================================================

export async function getSetting(key: string) {
  const result = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return result[0]?.value || null;
}

export async function updateSetting(key: string, value: any) {
  const result = await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    })
    .returning();
  return result[0];
}

// =====================================================
// 统计查询
// =====================================================

export async function getDashboardStats() {
  const [productCount] = await db
    .select({ count: count() })
    .from(products)
    .where(isNull(products.deletedAt));

  const [brandCount] = await db
    .select({ count: sql`COUNT(DISTINCT ${products.brand})` })
    .from(products)
    .where(isNull(products.deletedAt));

  const [categoryCount] = await db
    .select({ count: count() })
    .from(categories);

  const [searchCount] = await db
    .select({ count: count() })
    .from(searchLogs);

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

export async function getBrands() {
  const result = await db
    .selectDistinct({ brand: products.brand })
    .from(products)
    .where(and(isNotNull(products.brand), isNull(products.deletedAt)))
    .orderBy(asc(products.brand));

  return result.map(r => r.brand);
}
