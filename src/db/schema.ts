/**
 * Drizzle ORM Schema 定义
 * 全品类家电产品数据库
 */

import { pgTable, bigint, text, numeric, integer, boolean, timestamp, jsonb, unique, customType } from 'drizzle-orm/pg-core';

// =====================================================
// bytea 自定义类型（PostgreSQL 二进制数据）
// =====================================================
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});

// =====================================================
// 图片表（本地已废弃并 DROP；schema 保留仅防旧代码引用）
// 本地：~/Desktop/crawler_test/images-data + /local-images/* ；线上：OSS CDN URL
// =====================================================
export const images = pgTable('images', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  imageData: bytea('image_data'),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  width: integer('width'),
  height: integer('height'),
  sourceUrl: text('source_url').unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =====================================================
// 分类表
// =====================================================
export const categories = pgTable('categories', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  displayName: text('display_name'),
  icon: text('icon'),
  parentId: bigint('parent_id', { mode: 'number' }),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =====================================================
// 产品表
// =====================================================
export const products = pgTable('products', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  brand: text('brand').notNull(),
  model: text('model'),
  categoryId: bigint('category_id', { mode: 'number' }),
  price: numeric('price', { precision: 10, scale: 2 }),
  originalPrice: numeric('original_price', { precision: 10, scale: 2 }),
  rating: numeric('rating', { precision: 3, scale: 1 }),
  reviewCount: integer('review_count').default(0),
  params: jsonb('params').default({}).notNull(),
  searchVector: text('search_vector'),
  pinyin: text('pinyin'),
  pinyinInitials: text('pinyin_initials'),
  mainImage: text('main_image'), // 主图：本地 /local-images 或 OSS CDN
  imageId: bigint('image_id', { mode: 'number' }), // 已废弃，应恒为 null
  sourceUrl: text('source_url').unique(),
  sourcePlatform: text('source_platform').default('pconline'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
  deletedBy: text('deleted_by'),
});

// =====================================================
// 产品图片：目前只做主图，存在 products.main_image（本地 /local-images 或 OSS URL）
// =====================================================

// =====================================================
// 品类参数规范表
// =====================================================
export const categoryParams = pgTable('category_params', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  categoryId: bigint('category_id', { mode: 'number' }).notNull(),
  paramKey: text('param_key').notNull(),
  displayName: text('display_name').notNull(),
  icon: text('icon'),
  paramType: text('param_type').default('text').notNull(),
  isCore: boolean('is_core').default(false),
  isFilter: boolean('is_filter').default(false),
  isSortable: boolean('is_sortable').default(false),
  enumValues: jsonb('enum_values'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // 唯一约束：同一分类下参数名不重复
  categoryParamUnique: unique('category_params_category_param_unique').on(
    table.categoryId, table.paramKey
  ),
}));

// =====================================================
// 管理员表
// =====================================================
export const admins = pgTable('admins', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  email: text('email'),
  phone: text('phone'),
  role: text('role').default('admin'),
  status: text('status').default('active'),
  avatar: text('avatar'),
  remark: text('remark'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastLogin: timestamp('last_login'),
});

// =====================================================
// 搜索日志表
// =====================================================
export const searchLogs = pgTable('search_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  keyword: text('keyword').unique().notNull(),
  searchCount: integer('search_count').default(1).notNull(),
  lastSearchedAt: timestamp('last_searched_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// =====================================================
// 操作日志表
// =====================================================
export const operationLogs = pgTable('operation_logs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  adminId: bigint('admin_id', { mode: 'number' }),
  operator: text('operator').notNull(),
  ip: text('ip'),
  type: text('type').notNull(),
  target: text('target'),
  result: text('result').default('success'),
  detail: text('detail'),
  createdAt: timestamp('created_at').defaultNow(),
});

// =====================================================
// 系统设置表
// =====================================================
export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
