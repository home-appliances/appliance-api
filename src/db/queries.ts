/**
 * Drizzle ORM 查询函数
 * 提供类型安全的数据库操作
 */

import { eq, desc, asc, like, ilike, sql, and, or, count, isNull, isNotNull, inArray, max } from 'drizzle-orm';
import { db, pool } from './drizzle.js';
import {categories,products,productImages,categoryParams,admins,searchLogs,operationLogs,systemSettings} from './schema.js';

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

/** 分类编码/名称唯一，编码去空格并小写 */
export class CategoryDuplicateError extends Error {
  existingId: number;
  field: 'code' | 'name';
  constructor(field: 'code' | 'name', existingId: number, detail: string) {
    super(detail);
    this.name = 'CategoryDuplicateError';
    this.field = field;
    this.existingId = existingId;
  }
}

export function normalizeCategoryCode(code: string): string {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\u00a0\u3000]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function normalizeCategoryName(name: string): string {
  return String(name || '').trim();
}

export async function findDuplicateCategory(opts: {
  code?: string | null;
  name?: string | null;
  excludeId?: number;
}): Promise<{ id: number; code: string; name: string; field: 'code' | 'name' } | null> {
  const code = opts.code ? normalizeCategoryCode(opts.code) : '';
  const name = opts.name ? normalizeCategoryName(opts.name) : '';
  const excludeId = opts.excludeId;

  if (code) {
    const byCode = await pool.query(
      `SELECT id, code, name FROM categories
       WHERE lower(regexp_replace(trim(both E' \\t\\n\\r\\u00a0' from code), '\\s+', '_', 'g')) = $1
         AND ($2::bigint IS NULL OR id <> $2)
       LIMIT 1`,
      [code, excludeId ?? null]
    );
    if (byCode.rows[0]) {
      return { ...byCode.rows[0], field: 'code' as const };
    }
  }

  if (name) {
    const byName = await pool.query(
      `SELECT id, code, name FROM categories
       WHERE trim(name) = $1
         AND ($2::bigint IS NULL OR id <> $2)
       LIMIT 1`,
      [name, excludeId ?? null]
    );
    if (byName.rows[0]) {
      return { ...byName.rows[0], field: 'name' as const };
    }
  }

  return null;
}

export async function assertCategoryUnique(opts: {
  code?: string | null;
  name?: string | null;
  excludeId?: number;
}): Promise<void> {
  const dup = await findDuplicateCategory(opts);
  if (!dup) return;
  if (dup.field === 'code') {
    throw new CategoryDuplicateError(
      'code',
      dup.id,
      `分类编码已存在：${dup.code}（ID ${dup.id}，名称「${dup.name}」）`
    );
  }
  throw new CategoryDuplicateError(
    'name',
    dup.id,
    `分类名称已存在：「${dup.name}」（ID ${dup.id}，编码 ${dup.code}）`
  );
}

export async function createCategory(data: typeof categories.$inferInsert) {
  const code = normalizeCategoryCode(String(data.code || ''));
  const name = normalizeCategoryName(String(data.name || ''));
  if (!code || !name) {
    throw new Error('分类编码和名称不能为空');
  }
  await assertCategoryUnique({ code, name });
  const result = await db
    .insert(categories)
    .values({
      ...data,
      code,
      name,
      displayName: normalizeCategoryName(String(data.displayName || name)) || name,
    })
    .returning();
  return result[0];
}

export async function updateCategory(id: number, data: Partial<typeof categories.$inferInsert>) {
  const patch: Partial<typeof categories.$inferInsert> = { ...data };
  if (patch.code !== undefined) {
    patch.code = normalizeCategoryCode(String(patch.code));
  }
  if (patch.name !== undefined) {
    patch.name = normalizeCategoryName(String(patch.name));
  }
  if (patch.displayName !== undefined) {
    patch.displayName = normalizeCategoryName(String(patch.displayName));
  }
  await assertCategoryUnique({
    code: patch.code,
    name: patch.name,
    excludeId: id,
  });
  const result = await db
    .update(categories)
    .set(patch)
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
  brand?: string | string[];
  categoryId?: number;
  categoryCode?: string;
  sort?: 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
} = {}) {
  const { page = 1, limit = 20, keyword, brand, categoryId, categoryCode, sort = 'created_at', order = 'desc' } = options;
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
    const brands = Array.isArray(brand) ? brand : [brand];
    conditions.push(or(...brands.map(b => ilike(products.brand, `%${b}%`))));
  }

  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  // 按分类 code 筛选（需关联 categories 表）
  if (categoryCode) {
    conditions.push(eq(categories.code, categoryCode));
  }

  // 只查询未删除的产品
  conditions.push(isNull(products.deletedAt));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 查询总数
  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(whereClause);

  // 查询数据（关联 categories 取分类名，主图从 product_images 取：main 类型优先，同类型 sort_order 升序）
  const sortColumn = sort === 'updated_at' ? products.updatedAt : products.createdAt;
  const orderFn = order === 'asc' ? asc : desc;

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
      mainImage: sql<string>`(
        SELECT ${productImages.imageUrl}
        FROM ${productImages}
        WHERE ${productImages.productId} = ${products.id}
        ORDER BY
          CASE ${productImages.imageType} WHEN 'main' THEN 0 ELSE 1 END,
          ${productImages.sortOrder}
        LIMIT 1
      )`.as('main_image'),
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(whereClause)
    .orderBy(orderFn(sortColumn))
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
      mainImage: sql<string>`(
        SELECT ${productImages.imageUrl}
        FROM ${productImages}
        WHERE ${productImages.productId} = ${products.id}
        ORDER BY
          CASE ${productImages.imageType} WHEN 'main' THEN 0 ELSE 1 END,
          ${productImages.sortOrder}
        LIMIT 1
      )`.as('main_image'),
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

/** 品牌 + 分类 + 型号（无型号则用名称）唯一，仅未软删产品 */
export class ProductDuplicateError extends Error {
  existingId: number;
  constructor(existingId: number, detail: string) {
    super(detail);
    this.name = 'ProductDuplicateError';
    this.existingId = existingId;
  }
}

/** 型号归一化：去空白/横杠/下划线/点，小写 → LY-CBS020URH 与 LYCBS020URH 视为同一 */
export function normalizeModelKey(raw: string): string {
  return (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.／／·•]/g, '');
}

function productIdentityKey(model?: string | null, name?: string | null): string {
  const m = (model || '').trim();
  const raw = m || (name || '').trim();
  return normalizeModelKey(raw);
}

export async function findDuplicateProduct(opts: {
  brand: string;
  categoryId: number | null | undefined;
  model?: string | null;
  name?: string | null;
  excludeId?: number;
}): Promise<{ id: number; name: string; brand: string; model: string | null } | null> {
  const brand = (opts.brand || '').trim();
  const categoryId = opts.categoryId ?? null;
  const identity = productIdentityKey(opts.model, opts.name);
  if (!brand || categoryId == null || !identity) return null;

  const conditions = [
    isNull(products.deletedAt),
    sql`trim(${products.brand}) = ${brand}`,
    eq(products.categoryId, categoryId),
    sql`regexp_replace(
          lower(trim(COALESCE(NULLIF(trim(${products.model}), ''), ${products.name}))),
          '[\\s\\-_.／·•]',
          '',
          'g'
        ) = ${identity}`,
  ];
  if (opts.excludeId != null) {
    conditions.push(sql`${products.id} <> ${opts.excludeId}`);
  }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      model: products.model,
    })
    .from(products)
    .where(and(...conditions))
    .limit(1);

  return rows[0] || null;
}

async function assertProductUnique(opts: {
  brand: string;
  categoryId: number | null | undefined;
  model?: string | null;
  name?: string | null;
  excludeId?: number;
}) {
  const brand = (opts.brand || '').trim();
  if (!brand) {
    throw new Error('品牌不能为空');
  }
  if (opts.categoryId == null || Number.isNaN(Number(opts.categoryId))) {
    throw new Error('请选择分类');
  }
  const identity = productIdentityKey(opts.model, opts.name);
  if (!identity) {
    throw new Error('型号或产品名称不能为空');
  }

  const dup = await findDuplicateProduct({
    brand,
    categoryId: Number(opts.categoryId),
    model: opts.model,
    name: opts.name,
    excludeId: opts.excludeId,
  });
  if (dup) {
    const label = (dup.model || '').trim() || dup.name;
    throw new ProductDuplicateError(
      dup.id,
      `该分类下已存在相同品牌与型号的产品：${dup.brand} / ${label}（ID ${dup.id}）`
    );
  }
}

export async function createProduct(data: typeof products.$inferInsert) {
  await assertProductUnique({
    brand: data.brand,
    categoryId: data.categoryId,
    model: data.model,
    name: data.name,
  });
  const result = await db.insert(products).values(data).returning();
  return result[0];
}

export async function updateProduct(id: number, data: Partial<typeof products.$inferInsert>) {
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('无效的产品 ID');
  }
  const existing = await getProductById(id);
  if (!existing) return null;

  await assertProductUnique({
    brand: data.brand !== undefined ? data.brand : existing.brand,
    categoryId: data.categoryId !== undefined ? data.categoryId : existing.categoryId,
    model: data.model !== undefined ? data.model : existing.model,
    name: data.name !== undefined ? data.name : existing.name,
    excludeId: id,
  });

  const result = await db
    .update(products)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteProduct(id: number, deletedBy?: string) {
  const images = await getProductImages(id);

  await db.delete(productImages).where(eq(productImages.productId, id));

  const result = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning();

  if (result[0]) {
    console.log(`[硬删除] 产品 #${id} 已被 ${deletedBy || '未知用户'} 删除，关联 ${images.length} 张图片`);
  }

  for (const img of images) {
    if (img.imageUrl && String(img.imageUrl).includes('cheapgo')) {
      try {
        const { deleteImage } = await import('../utils/oss.js');
        await deleteImage(img.imageUrl);
      } catch (e) {
        console.warn(`[删除产品] OSS 图片清理失败（不影响主流程）:`, e);
      }
    }
  }

  return result[0] || null;
}

export async function batchDeleteProducts(ids: number[], deletedBy?: string): Promise<number> {
  const allImages: MainImageRow[] = [];
  for (const id of ids) {
    const imgs = await getProductImages(id);
    allImages.push(...imgs);
  }

  await db.delete(productImages).where(inArray(productImages.productId, ids));
  await db.delete(products).where(inArray(products.id, ids));

  console.log(`[批量硬删除] ${ids.length} 个产品已被 ${deletedBy || '未知用户'} 删除，关联 ${allImages.length} 张图片`);

  for (const img of allImages) {
    if (img.imageUrl && String(img.imageUrl).includes('cheapgo')) {
      try {
        const { deleteImage } = await import('../utils/oss.js');
        await deleteImage(img.imageUrl);
      } catch (e) {
        console.warn(`[批量删除产品] OSS 图片清理失败（不影响主流程）:`, e);
      }
    }
  }

  return ids.length;
}

// =====================================================
// =====================================================
// 产品图片（product_images 表，多类型：main/display/detail/scene）
// 主图 = 该产品 image_type='main' 中 sort_order 最小的那条
// =====================================================

type MainImageRow = {
  id: number;
  productId: number;
  imageUrl: string;
  imageType: string;
  sortOrder: number;
};

export async function getProductImages(productId: number) {
  const result = await db
    .select({
      id: productImages.id,
      productId: productImages.productId,
      imageUrl: productImages.imageUrl,
      imageType: productImages.imageType,
      sortOrder: productImages.sortOrder,
    })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.imageType), asc(productImages.sortOrder), asc(productImages.id));
  return result as MainImageRow[];
}

export async function getProductImageById(id: number) {
  const result = await db
    .select({
      id: productImages.id,
      productId: productImages.productId,
      imageUrl: productImages.imageUrl,
      imageType: productImages.imageType,
      sortOrder: productImages.sortOrder,
    })
    .from(productImages)
    .where(eq(productImages.id, id))
    .limit(1);
  return (result[0] as MainImageRow) || null;
}

/**
 * 新增产品图片。sort_order 由服务端独占分配（同产品同类型 max+1）。
 * 调整顺序请走 updateProductImage / updateProductImageSort，勿在创建时传 sort。
 */
export async function createProductImage(data: {
  productId: number;
  imageUrl?: string | null;
  imageType?: string;
}) {
  if (!data.productId || !data.imageUrl) {
    throw new Error('createProductImage 需要 productId 与 imageUrl');
  }
  const imageType = data.imageType || 'main';

  // 唯一约束 product_images_product_type_sort_unique (product_id, image_type, sort_order)
  const existing = await db
    .select({ maxSort: max(productImages.sortOrder) })
    .from(productImages)
    .where(and(
      eq(productImages.productId, data.productId),
      eq(productImages.imageType, imageType),
    ));
  const sortOrder = (existing[0]?.maxSort ?? -1) + 1;

  const result = await db
    .insert(productImages)
    .values({
      productId: data.productId,
      imageUrl: data.imageUrl,
      imageType,
      sortOrder,
    })
    .returning();
  return result[0] as MainImageRow;
}

export async function updateProductImage(
  id: number,
  data: Partial<{ imageUrl: string; imageType: string; sortOrder: number }>
) {
  const set: Record<string, unknown> = {};
  if (data.imageUrl !== undefined) set.imageUrl = data.imageUrl;
  if (data.imageType !== undefined) set.imageType = data.imageType;
  if (data.sortOrder !== undefined) set.sortOrder = data.sortOrder;
  if (Object.keys(set).length === 0) {
    return await getProductImageById(id);
  }
  const result = await db
    .update(productImages)
    .set(set)
    .where(eq(productImages.id, id))
    .returning();
  return (result[0] as MainImageRow) || null;
}

export async function deleteProductImage(id: number) {
  const before = await getProductImageById(id);
  await db.delete(productImages).where(eq(productImages.id, id));
  return before;
}

export async function batchDeleteProductImages(ids: number[]) {
  const out: MainImageRow[] = [];
  for (const id of ids) {
    const row = await deleteProductImage(id);
    if (row) out.push(row);
  }
  return out;
}

// 取主图 URL（image_type='main' 中 sort_order 最小的一条）
export async function getMainImageUrl(productId: number): Promise<string | null> {
  const result = await db
    .select({ url: productImages.imageUrl })
    .from(productImages)
    .where(and(
      eq(productImages.productId, productId),
      eq(productImages.imageType, 'main'),
    ))
    .orderBy(asc(productImages.sortOrder))
    .limit(1);
  return result[0]?.url ?? null;
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
    .select({ count: sql<number>`COUNT(DISTINCT ${products.brand})` })
    .from(products)
    .where(isNull(products.deletedAt));

  const [categoryCount] = await db
    .select({ count: count() })
    .from(categories);

  const [searchCount] = await db
    .select({ count: sql<number>`COALESCE(SUM(${searchLogs.searchCount}), 0)` })
    .from(searchLogs);

  return {
    totalProducts: productCount.count,
    totalBrands: brandCount.count,
    totalCategories: categoryCount.count,
    totalSearches: Number(searchCount.count),
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
