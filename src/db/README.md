# 数据库模块

本目录包含 PostgreSQL 数据库设计和操作代码，用于存储爬取的电器产品数据。

## 文件结构

```
hono/src/db/
├── schema.sql    # 数据库表结构定义（遵循 Supabase Best Practices）
├── index.ts      # 数据库连接和操作函数
├── example.ts    # 使用示例
├── init.ts       # 数据库初始化脚本
└── README.md     # 本文件
```

## 设计原则（遵循 Supabase PostgreSQL Best Practices）

### 1. 主键策略
- 使用 `BIGINT GENERATED ALWAYS AS IDENTITY`（SQL 标准）
- 比 `SERIAL` 更优，支持最多 9 quintillion 条记录

### 2. 数据类型选择
- 字符串使用 `TEXT`（无长度限制，性能与 VARCHAR 相同）
- 时间使用 `TIMESTAMPTZ`（带时区）
- 灵活数据使用 `JSONB`（支持索引和高效查询）
- 二进制数据使用 `BYTEA`

### 3. 命名规范
- 表名和字段名使用小写 snake_case
- 避免大小写敏感问题

### 4. 索引设计
- JSONB 字段使用 GIN 索引
- 高频查询字段建立 B-tree 索引
- 复合索引优化组合查询

## 快速开始

### 1. 配置环境变量

在项目根目录创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=appliance_crawler
DB_USER=postgres
DB_PASSWORD=your_password
```

### 2. 安装依赖

```bash
cd hono
npm install pg @types/pg
```

### 3. 初始化数据库

```bash
# 使用 tsx 运行初始化脚本
npx tsx src/db/init.ts
```

这将：
- 创建 `appliance_crawler` 数据库
- 创建 `images` 和 `products` 表
- 创建必要的索引

### 4. 运行示例

```bash
npx tsx src/db/example.ts
```

## 表结构说明

### images 表（图片）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| image_data | BYTEA | 图片二进制数据 |
| mime_type | TEXT | MIME 类型（如 image/jpeg） |
| file_size | INTEGER | 文件大小（字节） |
| width | INTEGER | 图片宽度 |
| height | INTEGER | 图片高度 |
| created_at | TIMESTAMPTZ | 创建时间 |

### products 表（产品）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT | 主键，自增 |
| name | TEXT | 产品名称 |
| brand | TEXT | 品牌 |
| category | TEXT | 类别（空调、冰箱等） |
| model | TEXT | 型号 |
| params | JSONB | 所有参数（灵活存储） |
| image_id | BIGINT | 关联图片 ID |
| source_url | TEXT | 爬取来源 URL |
| source_platform | TEXT | 来源平台（京东、淘宝等） |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

## 使用示例

### 插入产品

```typescript
import { insertProduct, insertImage } from './db';

// 1. 插入图片
const imageId = await insertImage(
  Buffer.from('image-data'),
  'image/jpeg',
  102400,  // 100KB
  800,
  600
);

// 2. 插入产品
const productId = await insertProduct({
  name: '格力 KFR-35GW/NhGc1B 空调',
  brand: '格力',
  category: '空调',
  model: 'KFR-35GW/NhGc1B',
  params: {
    power: '1.5匹',
    energy_level: '一级能效',
    voltage: '220V',
  },
  imageId,
  sourceUrl: 'https://item.jd.com/xxx.html',
  sourcePlatform: '京东',
});
```

### JSONB 查询

```typescript
import { queryByParams, queryByParamField } from './db';

// 使用 @> 包含查询
const products = await queryByParams({ energy_level: '一级能效' });

// 使用 ->> 字段查询
const air conditioners = await queryByParamField('power', '1.5匹');
```

### 全文搜索

```typescript
import { searchByName } from './db';

const results = await searchByName('空调');
```

### 联合查询（含图片）

```typescript
import { getProductWithImage } from './db';

const detail = await getProductWithImage(productId);
// detail.image_data 包含图片二进制数据
```

## 索引说明

| 索引名 | 类型 | 用途 |
|--------|------|------|
| idx_products_params_gin | GIN | JSONB 字段高效查询 |
| idx_products_brand | B-tree | 按品牌筛选 |
| idx_products_category | B-tree | 按类别筛选 |
| idx_products_brand_category | B-tree | 品牌+类别组合查询 |
| idx_products_created_at | B-tree | 按时间排序 |
| idx_products_name_search | GIN | 全文搜索产品名称 |
| idx_images_mime_type | B-tree | 按图片类型筛选 |

## 性能优化建议

1. **批量插入**：使用 `batchInsertProducts` 函数，开启事务
2. **JSONB 查询**：常用查询字段可单独建索引
3. **图片存储**：几十万条数据直接存数据库没问题，超过百万考虑分表
4. **连接池**：默认最大 20 个连接，可根据需要调整

## 扩展建议

如果数据量超过百万，考虑：
1. 按品牌或类别分区（Partitioning）
2. 图片表单独分库
3. 使用 BRIN 索引优化时间序列查询
