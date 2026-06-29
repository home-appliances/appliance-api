# 图片存储功能实现总结

## ✅ 已完成的工作

### 1. 图片 API 路由 (`src/routes/image.ts`)

**新增接口：**
- `POST /api/image/download` - 从 URL 下载图片并存储
- `POST /api/image/upload` - 上传本地图片文件
- `GET /api/image/:id` - 读取图片（返回二进制数据）
- `GET /api/image/product/:productId` - 获取产品图片列表
- `DELETE /api/image/:id` - 删除图片

### 2. 更新搜索和详情接口

**搜索接口 (`src/routes/search.ts`)：**
- 优先使用 `image_id` 从 images 表获取图片
- 返回 `/api/image/:id` 格式的 URL
- 降级支持旧的 data URL 和 HTTP URL

**详情接口 (`src/routes/detail.ts`)：**
- 优先使用 `image_id` 获取主图
- 返回图片 URL 列表
- 保持向后兼容

### 3. 批量导入脚本 (`src/db/import-images.ts`)

**功能：**
- 自动获取所有需要导入图片的产品
- 并发下载（3个并发）
- 自动去重（按 source_url）
- 自动关联到产品
- 显示进度和统计

### 4. 测试脚本 (`src/db/test-image-api.ts`)

测试所有图片 API 接口是否正常工作

### 5. 文档

- `src/db/IMAGE_STORAGE.md` - 详细使用文档
- `IMAGE_API_SUMMARY.md` - 本总结文档

---

## 🚀 使用方法

### 1. 启动后端服务

```bash
cd hono
npm run dev
```

### 2. 批量导入现有图片

```bash
cd hono
npx tsx src/db/import-images.ts
```

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

### 3. 测试接口

```bash
cd hono
npx tsx src/db/test-image-api.ts
```

### 4. 前端使用

#### 获取产品图片
```typescript
// 方式 1：直接使用图片接口
<Image src={`http://192.168.3.47:3000/api/image/${imageId}`} />

// 方式 2：从详情接口获取
const res = await Taro.request({
  url: 'http://192.168.3.47:3000/api/detail?id=1'
});
const { images } = res.data.data;
// images[0] = "/api/image/1"
```

#### 上传图片
```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('product_id', '123');

const res = await Taro.request({
  url: 'http://192.168.3.47:3000/api/image/upload',
  method: 'POST',
  data: formData,
  header: { 'Content-Type': 'multipart/form-data' }
});
```

---

## 📊 数据库结构

### images 表
```sql
CREATE TABLE images (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    image_data BYTEA NOT NULL,           -- 图片二进制数据
    mime_type TEXT NOT NULL,              -- MIME 类型
    file_size INTEGER,                   -- 文件大小
    source_url TEXT UNIQUE,              -- 原始 URL（去重）
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### products 表关联
```sql
ALTER TABLE products ADD COLUMN image_id BIGINT REFERENCES images(id);
```

---

## 🔄 图片获取流程

```
1. 前端请求产品列表/详情
       ↓
2. 后端查询 products 表
       ↓
3. 检查 image_id 字段
       ↓
4. 如果有 image_id：
   → 返回 /api/image/:id
   → 前端直接请求该 URL
   → 后端从 images 表读取二进制数据
   → 返回图片

5. 如果没有 image_id：
   → 降级使用 images 数组中的 URL
   → 返回 data: URL 或 http URL
```

---

## 🎯 优势

1. **统一管理**：所有图片集中存储在数据库
2. **去重机制**：按 source_url 去重，节省存储空间
3. **快速访问**：数据库查询比文件系统更快
4. **备份简单**：数据库备份即可保存所有图片
5. **向后兼容**：支持旧的 data URL 和 HTTP URL

---

## ⚠️ 注意事项

1. **图片大小限制**：建议单张图片不超过 5MB
2. **并发控制**：批量导入默认 3 个并发
3. **存储空间**：图片以二进制存储，数据库体积会增大
4. **备份策略**：定期备份数据库，图片数据不可恢复

---

## 📈 性能优化建议

1. **添加索引**：已为 source_url 创建唯一索引
2. **缓存策略**：图片接口设置了 24 小时缓存
3. **压缩图片**：可在存储前压缩图片（当前未实现）
4. **CDN 集成**：可将图片同步到 CDN 加速

---

## 🔧 后续优化方向

1. **图片压缩**：存储前自动压缩，减少存储空间
2. **缩略图**：生成不同尺寸的缩略图
3. **异步处理**：使用消息队列处理大量图片
4. **图片分析**：提取图片尺寸、颜色等信息
