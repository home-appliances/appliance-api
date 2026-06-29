# 数据库优化迁移指南

## 概述

本次迁移解决以下问题：
1. ✅ 产品分类标准化（新增 `categories` 表）
2. ✅ 修复 `search_logs` 表结构冲突
3. ✅ 优化 `params` JSONB 字段（添加索引和验证）
4. ✅ 统一图片存储方式（推荐使用 `image_id`）

## 迁移步骤

### 1. 备份数据库（重要！）

```bash
pg_dump -U postgres -d appliance_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 执行迁移脚本

```bash
cd hono
npx tsx src/db/run-optimize.ts
```

### 3. 验证迁移结果

```bash
# 连接数据库检查
psql -U postgres -d appliance_db

# 检查分类表
SELECT * FROM categories;

# 检查产品分类关联
SELECT
  p.id,
  p.name,
  p.category as old_category,
  c.name as new_category
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LIMIT 10;

# 检查 search_logs 表结构
\d search_logs
```

## 新增 API 接口

### 获取分类列表
```
GET /api/categories
```

**响应示例：**
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "code": "icebox",
      "name": "冰箱",
      "parent_id": null,
      "product_count": 150,
      "children": [
        {
          "id": 12,
          "code": "icebox_single",
          "name": "单门冰箱",
          "parent_id": 1,
          "product_count": 30
        }
      ]
    }
  ]
}
```

### 获取分类产品
```
GET /api/category/:id?page=1&limit=20
```

## 代码更新

### 使用新的分类字段

```typescript
// 旧方式
const category = product.category; // "icebox"

// 新方式（推荐）
const categoryId = product.category_id;
const categoryName = product.category_name; // 从视图获取
```

### 统一图片获取

```typescript
// 旧方式（混合使用）
if (product.image_id) {
  // 从 images 表获取
} else if (product.images?.length > 0) {
  // 从数组获取
}

// 新方式（统一使用）
import { getProductImagesList } from '../db/index.js';

const images = await getProductImagesList(productId);
// 返回: [{ id, url, mime_type }]
```

## 新增的数据库对象

### 表
- `categories` - 产品分类表（支持层级）

### 视图
- `products_with_details` - 产品详情视图（包含图片和分类）

### 函数
- `validate_product_params(params JSONB)` - 验证产品参数
- `search_products_fulltext(keyword, category, page, limit)` - 全文搜索函数
- `log_search(keyword)` - 记录搜索日志（已修复）

### 索引
- `idx_products_category_id` - 分类ID索引
- `idx_products_params_energy` - 能效等级索引
- `idx_products_params_type` - 产品类别索引
- `idx_products_params_ac_type` - 空调类型索引
- `idx_products_params_ac_power` - 空调匹数索引
- `idx_products_params_fridge_capacity` - 冰箱容积索引
- `idx_products_params_washer_capacity` - 洗衣机容量索引

## 回滚方案

如果迁移出现问题，可以回滚：

```bash
# 1. 恢复备份
psql -U postgres -d appliance_db < backup_20240101_120000.sql

# 2. 或者手动回滚
DROP TABLE IF EXISTS categories CASCADE;
DROP VIEW IF EXISTS products_with_details;
DROP FUNCTION IF EXISTS search_products_fulltext;
```

## 后续优化（可选）

1. **删除冗余字段**（确认代码已迁移后）：
   ```sql
   ALTER TABLE products DROP COLUMN IF EXISTS images;
   ALTER TABLE products DROP COLUMN IF EXISTS category;
   ```

2. **添加参数验证约束**：
   ```sql
   ALTER TABLE products
   ADD CONSTRAINT check_params_valid
   CHECK (validate_product_params(params));
   ```

3. **迁移到对象存储**（如果图片量大）：
   - 将图片从数据库迁移到 MinIO/阿里 OSS
   - 只存储图片 URL，不存储二进制数据

## 常见问题

### Q: 迁移会丢失数据吗？
A: 不会。迁移脚本使用 `IF NOT EXISTS` 和 `ON CONFLICT` 保护现有数据。

### Q: 迁移需要停机吗？
A: 不需要。迁移脚本可以在服务运行时执行，但建议在低峰期进行。

### Q: 如何验证迁移成功？
A: 运行 `npx tsx src/db/run-optimize.ts` 会输出验证信息。

## 联系支持

如果遇到问题，请检查：
1. 数据库连接配置（`.env` 文件）
2. PostgreSQL 版本（建议 14+）
3. 错误日志输出
