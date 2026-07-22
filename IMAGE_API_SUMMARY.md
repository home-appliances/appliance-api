# 图片存储说明

产品图片以两种方式并存：

1. **库内二进制**（`images` 表）→ 通过 `/api/image/:id` 读取  
2. **OSS + CDN**（管理后台上传）→ `https://static.cheapgo.top/...`

日常维护优先用管理后台「产品管理 / 图片管理」；脚本用于批量补全历史数据。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/image/:id` | 按 `images.id` 返回二进制 |
| GET | `/api/image/product/:productId` | 产品关联图片列表 |
| POST | `/api/image/download` | 从 URL 下载并入库 |
| POST | `/api/image/upload` | 上传本地文件入库 |
| DELETE | `/api/image/:id` | 删除图片 |

搜索 / 详情接口优先使用 `products.main_image` 或 `image_id`（`/api/image/:id`），否则回退到 URL。

## 相关脚本

| 脚本 | 说明 | 命令 |
|------|------|------|
| `src/db/import-images.ts` | 将产品 URL 图片下载写入 `images` 表 | `npx tsx src/db/import-images.ts` |
| `scripts/migrate-main-image.ts` | 补全 `main_image` / `image_id` | `npm run migrate:main-image` |

更多数据库与运维脚本见 [`src/db/README.md`](./src/db/README.md)、[`scripts/README.md`](./scripts/README.md)。

## 数据表（节选）

```sql
-- 二进制图片
CREATE TABLE images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    image_data BYTEA NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    source_url TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 产品关联
-- products.image_id  → images.id
-- products.main_image → 展示用 URL（如 /api/image/:id 或 CDN）
```

## 管理后台上传（OSS）

1. 后台选择/拖拽图片 → Base64 暂存  
2. 提交产品时上传 OSS（`cheapgo-assets`）  
3. CDN：`static.cheapgo.top`  

校验：扩展名与 MIME 白名单、≤ 5MB。详见根目录 [`README.md`](./README.md)「图片上传」一节。

## 注意

- 单张建议 ≤ 5MB  
- 批量导入注意并发与磁盘/库容量  
- 库内二进制需随数据库一起备份  
