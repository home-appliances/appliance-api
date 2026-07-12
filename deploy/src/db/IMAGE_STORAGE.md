# 图片存储功能说明

## 功能概述

图片以 `bytea` 二进制格式存储在 PostgreSQL 数据库中，支持：
- 从 URL 下载图片并存储
- 上传本地图片文件
- 读取数据库中的图片
- 批量导入现有图片

## API 接口

### 1. 从 URL 下载图片

```http
POST /api/image/download
Content-Type: application/json

{
  "url": "https://example.com/image.jpg",
  "product_id": 123  // 可选，关联到产品
}
```

**响应：**
```json
{
  "code": 0,
  "message": "图片下载成功",
  "data": {
    "id": 1,
    "mime_type": "image/jpeg",
    "file_size": 12345
  }
}
```

### 2. 上传图片文件

```http
POST /api/image/upload
Content-Type: multipart/form-data

file: <图片文件>
product_id: 123  // 可选
```

### 3. 读取图片

```http
GET /api/image/:id
```

返回图片二进制数据，可直接用于 `<img src="/api/image/1">`

### 4. 获取产品图片列表

```http
GET /api/image/product/:productId
```

**响应：**
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "url": "/api/image/1",
      "mime_type": "image/jpeg",
      "file_size": 12345,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 5. 删除图片

```http
DELETE /api/image/:id
```

## 批量导入脚本

将产品表中 URL 图片下载并存储到数据库：

```bash
cd hono
npx tsx src/db/import-images.ts
```

**功能：**
- 自动获取所有需要导入图片的产品
- 并发下载（3个并发）
- 自动去重（按 source_url）
- 自动关联到产品
- 显示进度和统计

**输出示例：**
```
🚀 开始批量导入图片

📊 找到 500 个需要导入图片的产品

📦 处理产品: 小米冰箱 (ID: 1)
   图片: https://img.pconline.com.cn/...
   ✅ 图片已保存，ID: 1, 大小: 45.2KB
   ✅ 已关联到产品

📊 导入统计:
   ✅ 成功: 450
   ⏭️  跳过: 50
   ❌ 失败: 0
```

## 测试接口

```bash
cd hono
npx tsx src/db/test-image-api.ts
```

## 前端使用

### 在 Taro 中使用

```tsx
// 获取产品图片
const getProductImage = async (productId: number) => {
  const res = await Taro.request({
    url: `http://192.168.3.47:3000/api/image/product/${productId}`,
    method: 'GET'
  });

  if (res.data.code === 0 && res.data.data.length > 0) {
    // 返回图片 URL（可用于 Image 组件）
    return `http://192.168.3.47:3000${res.data.data[0].url}`;
  }

  return '/static/default_img.png';
};

// 在组件中使用
<Image src={imageUrl} mode="aspectFit" />
```

### 直接使用图片接口

```tsx
<Image
  src={`http://192.168.3.47:3000/api/image/${imageId}`}
  mode="aspectFit"
/>
```

## 数据库结构

### images 表

```sql
CREATE TABLE images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    image_data BYTEA NOT NULL,           -- 图片二进制数据
    mime_type TEXT NOT NULL,              -- MIME 类型
    file_size INTEGER,                   -- 文件大小（字节）
    width INTEGER,                       -- 图片宽度
    height INTEGER,                      -- 图片高度
    source_url TEXT UNIQUE,              -- 原始 URL（用于去重）
    created_at TIMESTAMPTZ DEFAULT NOW() -- 创建时间
);
```

### products 表关联

```sql
ALTER TABLE products ADD COLUMN image_id BIGINT REFERENCES images(id);
```

## 注意事项

1. **图片大小限制**：建议单张图片不超过 5MB
2. **并发控制**：批量导入默认 3 个并发，可在脚本中调整
3. **去重机制**：按 `source_url` 去重，相同 URL 只存储一次
4. **备份建议**：定期备份数据库，图片数据不可恢复

## 性能优化

1. **索引**：已为 `source_url` 创建唯一索引
2. **缓存**：图片接口设置了 24 小时缓存
3. **压缩**：可在存储前压缩图片（当前未实现）

## 后续优化方向

1. **图片压缩**：存储前自动压缩，减少存储空间
2. **缩略图**：生成不同尺寸的缩略图
3. **CDN 集成**：将图片同步到 CDN
4. **异步处理**：使用消息队列处理大量图片
